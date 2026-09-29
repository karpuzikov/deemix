package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	webview2 "github.com/jchv/go-webview2"
	"github.com/sqweek/dialog"
)

// The workflow generates this directory before go build.
//go:embed payload/node.zip payload/server.mjs payload/public
var payload embed.FS

const bridgeJS = `
(() => {
	const receivers = new Map();

	window.api = {
		send: async (channel, data) => {
			if (channel === "openDownloadsFolder") {
				try {
					const response = await fetch("/api/getSettings");
					const body = await response.json();
					const path = body?.settings?.downloadLocation || "";
					if (path) await nativeOpenFolder(path);
				} catch (error) {
					console.error(error);
				}
				return;
			}

			if (channel === "selectDownloadFolder") {
				try {
					const selected = await nativeSelectFolder(String(data || ""));
					if (!selected) return;
					const callbacks = receivers.get("downloadFolderSelected") || [];
					for (const callback of callbacks) callback(selected);
				} catch (error) {
					console.error(error);
				}
			}
		},
		receive: (channel, callback) => {
			if (typeof callback !== "function") return;
			const callbacks = receivers.get(channel) || [];
			callbacks.push(callback);
			receivers.set(channel, callbacks);
		},
	};

	document.addEventListener("click", (event) => {
		const target = event.target instanceof Element ? event.target.closest("a") : null;
		if (!target || target.target !== "_blank" || !target.href) return;
		event.preventDefault();
		nativeOpenExternal(target.href).catch(console.error);
	}, true);
})();
`

func main() {
	runtimeDir, err := prepareRuntime()
	if err != nil {
		showFatal("Failed to prepare Deemix runtime", err)
		return
	}

	cmd, baseURL, logFile, err := startServer(runtimeDir)
	if err != nil {
		showFatal("Failed to start Deemix", err)
		return
	}
	defer func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
			_, _ = cmd.Process.Wait()
		}
		if logFile != nil {
			_ = logFile.Close()
		}
	}()

	if err := waitForServer(baseURL, 30*time.Second); err != nil {
		message := err.Error()
		if data, readErr := os.ReadFile(filepath.Join(runtimeDir, "server.log")); readErr == nil {
			logText := strings.TrimSpace(string(data))
			if logText != "" {
				if len(logText) > 4000 {
					logText = logText[len(logText)-4000:]
				}
				message += "\n\nServer log:\n" + logText
			}
		}
		showFatal("Deemix server did not start", errors.New(message))
		return
	}

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:  "Deemix",
			Width:  1100,
			Height: 760,
			Center: true,
		},
	})
	if w == nil {
		showFatal("Failed to create WebView2 window", errors.New("WebView2 runtime is unavailable"))
		return
	}
	defer w.Destroy()

	_ = w.Bind("nativeOpenFolder", func(path string) error {
		return openFolder(path)
	})
	_ = w.Bind("nativeSelectFolder", func(_ string) (string, error) {
		path, err := dialog.Directory().Title("Select download folder").Browse()
		if errors.Is(err, dialog.Cancelled) {
			return "", nil
		}
		return path, err
	})
	_ = w.Bind("nativeOpenExternal", func(rawURL string) error {
		return openExternal(rawURL)
	})

	w.Init(bridgeJS)
	w.SetSize(800, 600, webview2.HintMin)
	w.Navigate(baseURL)
	w.Run()
}

func prepareRuntime() (string, error) {
	nodeZip, err := payload.ReadFile("payload/node.zip")
	if err != nil {
		return "", err
	}
	serverJS, err := payload.ReadFile("payload/server.mjs")
	if err != nil {
		return "", err
	}

	hash := sha256.New()
	_, _ = hash.Write(nodeZip)
	_, _ = hash.Write(serverJS)
	version := hex.EncodeToString(hash.Sum(nil))[:16]

	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	runtimeDir := filepath.Join(cacheDir, "Deemix", "native-runtime", version)
	marker := filepath.Join(runtimeDir, ".ready")
	if _, err := os.Stat(marker); err == nil {
		return runtimeDir, nil
	}

	if err := os.RemoveAll(runtimeDir); err != nil {
		return "", err
	}
	if err := os.MkdirAll(runtimeDir, 0o755); err != nil {
		return "", err
	}

	if err := os.WriteFile(filepath.Join(runtimeDir, "server.mjs"), serverJS, 0o644); err != nil {
		return "", err
	}
	if err := extractNode(nodeZip, filepath.Join(runtimeDir, "node.exe")); err != nil {
		return "", err
	}
	if err := extractPublic(runtimeDir); err != nil {
		return "", err
	}
	if err := os.WriteFile(marker, []byte("ok"), 0o644); err != nil {
		return "", err
	}

	return runtimeDir, nil
}

func extractNode(zipBytes []byte, destination string) error {
	reader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		return err
	}

	for _, file := range reader.File {
		if !strings.EqualFold(filepath.Base(file.Name), "node.exe") {
			continue
		}

		source, err := file.Open()
		if err != nil {
			return err
		}
		defer source.Close()

		target, err := os.Create(destination)
		if err != nil {
			return err
		}
		if _, err := io.Copy(target, source); err != nil {
			_ = target.Close()
			return err
		}
		return target.Close()
	}
	return errors.New("node.exe not found in embedded runtime")
}

func extractPublic(runtimeDir string) error {
	return fs.WalkDir(payload, "payload/public", func(sourcePath string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relative := strings.TrimPrefix(sourcePath, "payload/")
		destination := filepath.Join(runtimeDir, filepath.FromSlash(relative))
		if entry.IsDir() {
			return os.MkdirAll(destination, 0o755)
		}

		data, err := payload.ReadFile(sourcePath)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return err
		}
		return os.WriteFile(destination, data, 0o644)
	})
}

func startServer(runtimeDir string) (*exec.Cmd, string, *os.File, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, "", nil, err
	}
	port := listener.Addr().(*net.TCPAddr).Port
	_ = listener.Close()

	logPath := filepath.Join(runtimeDir, "server.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return nil, "", nil, err
	}

	cmd := exec.Command(filepath.Join(runtimeDir, "node.exe"), filepath.Join(runtimeDir, "server.mjs"))
	cmd.Dir = runtimeDir
	cmd.Env = append(os.Environ(),
		"NODE_ENV=production",
		"GUI_VERSION=native-webview2",
		fmt.Sprintf("DEEMIX_SERVER_PORT=%d", port),
		"DEEMIX_HOST=127.0.0.1",
	)
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:     true,
		CreationFlags: 0x08000000,
	}

	if err := cmd.Start(); err != nil {
		_ = logFile.Close()
		return nil, "", nil, err
	}

	return cmd, fmt.Sprintf("http://127.0.0.1:%d", port), logFile, nil
}

func waitForServer(baseURL string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: time.Second}

	for time.Now().Before(deadline) {
		response, err := client.Get(baseURL + "/api/connect")
		if err == nil {
			_ = response.Body.Close()
			if response.StatusCode >= 200 && response.StatusCode < 500 {
				return nil
			}
		}
		time.Sleep(200 * time.Millisecond)
	}

	return fmt.Errorf("timed out waiting for %s", baseURL)
}

func openFolder(path string) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return errors.New("empty folder path")
	}
	return exec.Command("explorer.exe", path).Start()
}

func openExternal(rawURL string) error {
	rawURL = strings.TrimSpace(rawURL)
	if !strings.HasPrefix(rawURL, "https://") && !strings.HasPrefix(rawURL, "http://") {
		return errors.New("unsupported external URL")
	}
	return exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", rawURL).Start()
}

func showFatal(title string, err error) {
	dialog.Message("%s\n\n%s", title, err.Error()).Title("Deemix").Error()
}

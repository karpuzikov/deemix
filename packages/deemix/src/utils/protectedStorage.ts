import { spawnSync } from "node:child_process";

/** Protects secrets using Windows DPAPI CurrentUser without placing them in command arguments. */
function runDpapi(input: string, operation: "Protect" | "Unprotect"): string {
	if (process.platform !== "win32") throw new Error("Windows DPAPI is unavailable.");
	const script = "Add-Type -AssemblyName System.Security; " +
		"$bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd()); " +
		"$result = [Security.Cryptography.ProtectedData]::" + operation +
		"($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser); " +
		"[Console]::Out.Write([Convert]::ToBase64String($result));";
	const output = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
		input,
		encoding: "utf8",
		windowsHide: true,
		timeout: 15000,
		maxBuffer: 1024 * 1024,
	});
	if (output.error || output.status !== 0 || !output.stdout?.trim())
		throw new Error("Windows DPAPI credential protection failed.");
	return output.stdout.trim();
}

export function protectWindowsSecret(plainText: string): string {
	return runDpapi(Buffer.from(plainText, "utf8").toString("base64"), "Protect");
}
export function unprotectWindowsSecret(protectedText: string): string {
	return Buffer.from(runDpapi(protectedText, "Unprotect"), "base64").toString("utf8");
}

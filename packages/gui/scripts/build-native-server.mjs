import * as esbuild from "esbuild";

await esbuild.build({
	entryPoints: ["../webui/dist/main.js"],
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node24",
	outfile: "../native-gui/payload/server.mjs",
	minify: true,
	legalComments: "none",
	banner: {
		js: 'import { createRequire as __nativeCreateRequire } from "node:module"; const require = __nativeCreateRequire(import.meta.url);',
	},
	external: ["utf-8-validate", "bufferutil", "lightningcss"],
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
		"process.env.GUI_VERSION": JSON.stringify("native-webview2"),
	},
});

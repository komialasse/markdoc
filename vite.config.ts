import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";



export default defineConfig({
	plugins: [sveltekit(), wasm(), topLevelAwait()],
	resolve: {
		alias: {
		  $lib: path.resolve("./src/lib"),
		},
	  },
	  server: {
		fs: {
		  // Allow serving files from one level up to the project root
		  allow: ['..'],
		},
		proxy: {
			"/api": {
			  target: "http://127.0.0.1:5050",
			  changeOrigin: true,
			  secure: false,
			  ws: true,
			},
		}
	}
});

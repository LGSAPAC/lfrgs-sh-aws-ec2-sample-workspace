import react from '@vitejs/plugin-react-swc';
import {defineConfig} from 'vite';

// Liferay serves the extension's files under /o/<extension-name>/, so every built URL
// (lazy chunks, images, fonts) must point there rather than at the site root.
export default defineConfig({
	build: {
		outDir: 'build/vite',
		rollupOptions: {
			output: {
				assetFileNames: 'assets/[name][extname]',
				chunkFileNames: '[name]-[hash].js',
				entryFileNames: 'main.js',
			},
		},
	},
	experimental: {
		renderBuiltUrl(filename: string) {
			return `/o/ec2-sample-react-app/${filename}`;
		},
	},
	plugins: [react()],
	server: {
		origin: 'http://localhost:5173',
	},
});

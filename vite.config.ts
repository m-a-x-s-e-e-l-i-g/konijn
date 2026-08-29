import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		allowedHosts: ['desktop-hucdjae.tailcb2363.ts.net']
	},
	plugins: [sveltekit()]
});

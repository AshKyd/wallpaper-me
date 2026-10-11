import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Single page app: every route is served by index.html and the client does the rest.
			// The host must serve index.html for any path (e.g. /circles?p=3), as there are no prerendered pages.
			adapter: adapter({ fallback: 'index.html' })
		})
	]
});

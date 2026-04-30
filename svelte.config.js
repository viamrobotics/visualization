import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		paths: {
			// SvelteKit requires no trailing slash here.
			// Set by the pr-preview workflow to /visualization/pr-preview/pr-<N>
			// so the static build resolves assets under that subpath.
			base: process.env.BASE_PATH ?? '',
		},
	},
}

export default config

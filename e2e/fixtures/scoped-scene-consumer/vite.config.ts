import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

import { failOnMissingOptionalPeer } from './failOnMissingOptionalPeer'

export default defineConfig({
	plugins: [svelte(), failOnMissingOptionalPeer()],
	// Scene.svelte imports an HDR environment map, which Vite otherwise parses as JavaScript.
	assetsInclude: ['**/*.hdr'],
	build: {
		target: 'esnext',
	},
})

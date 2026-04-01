import { sentrySvelteKit } from '@sentry/sveltekit'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import dns from 'node:dns'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import glsl from 'vite-plugin-glsl'
import mkcert from 'vite-plugin-mkcert'

dns.setDefaultResultOrder('verbatim')

const https = process.argv.includes('--https')

export default defineConfig({
	assetsInclude: ['**/*.hdr'],
	plugins: [
		glsl(),
		sentrySvelteKit({
			sourceMapsUploadOptions: {
				org: 'viam',
				project: 'motion-tools',
			},
		}),
		devtoolsJson(),
		...(https ? [mkcert()] : []),
		tailwindcss(),
		sveltekit(),
		svelteTesting({ resolveBrowser: false }),
	],

	define: {
		BACKEND_IP: JSON.stringify('localhost'),
		WS_PORT: JSON.stringify(process.env.WS_PORT || '3000'),
	},

	optimizeDeps: {
		esbuildOptions: {
			target: 'esnext',
		},
		exclude: ['@testing-library/svelte'],
	},
	build: {
		target: 'esnext',
	},

	server: {
		host: true,
		port: Number.parseInt(process.env.STATIC_PORT || '5173', 10),
		allowedHosts: true,
		cors: true,
		https: https ? {} : undefined,

		fs: {
			allow: ['./package.json'],
		},
	},

	ssr: {
		noExternal: ['camera-controls'],
	},

	test: {
		browser: {
			enabled: true,
			headless: true,
			provider: 'playwright',
			instances: [{ browser: 'chromium' }],
		},
		clearMocks: true,
		include: ['src/**/*.{test,spec}.{js,ts}'],
		setupFiles: ['./vitest-setup-client.ts'],
	},
})

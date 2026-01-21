import { sentrySvelteKit } from '@sentry/sveltekit'
import devtoolsJson from 'vite-plugin-devtools-json'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { svelteTesting } from '@testing-library/svelte/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import dns from 'node:dns'

dns.setDefaultResultOrder('verbatim')

const https = false

export default defineConfig({
	plugins: [
		sentrySvelteKit({
			sourceMapsUploadOptions: {
				org: 'viam',
				project: 'motion-tools',
			},
		}),
		devtoolsJson(),
		...(https ? [basicSsl()] : []),
		tailwindcss(),
		sveltekit(),
	],

	define: {
		BACKEND_IP: JSON.stringify('localhost'),
		WS_PORT: JSON.stringify(process.env.WS_PORT || '3000'),
	},

	optimizeDeps: {
		esbuildOptions: {
			target: 'esnext',
		},
	},
	build: {
		target: 'esnext',
	},

	server: {
		host: true,
		port: parseInt(process.env.STATIC_PORT || '5173', 10),
		allowedHosts: true,
		cors: true,
		https: https ? {} : undefined,
	},

	ssr: {
		noExternal: ['camera-controls'],
	},

	test: {
		workspace: [
			{
				extends: './vite.config.ts',
				plugins: [svelteTesting()],

				test: {
					name: 'client',
					environment: 'jsdom',
					clearMocks: true,
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts'],
				},
			},
			{
				extends: './vite.config.ts',

				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
				},
			},
		],
	},
})

import { sentrySvelteKit } from '@sentry/sveltekit'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import dns from 'node:dns'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import glsl from 'vite-plugin-glsl'

dns.setDefaultResultOrder('verbatim')

const https = false

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
		projects: [
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

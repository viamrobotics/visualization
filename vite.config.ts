import { sentrySvelteKit } from '@sentry/sveltekit'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import dns from 'node:dns'
import devtoolsJson from 'vite-plugin-devtools-json'
import glsl from 'vite-plugin-glsl'
import mkcert from 'vite-plugin-mkcert'
import { defineConfig } from 'vitest/config'

import { version } from './package.json'

dns.setDefaultResultOrder('verbatim')

const https = process.argv.includes('--https')

export default defineConfig({
	assetsInclude: ['**/*.hdr'],
	plugins: [
		glsl(),
		sentrySvelteKit({
			sourceMapsUploadOptions: {
				org: 'viam',
				// Sentry project slug, not the package name. It stays until the project is
				// renamed in Sentry; a mismatch silently breaks symbolication.
				project: 'motion-tools',
				// Must match `release` in hooks.client.ts. The default is the git HEAD SHA, which no
				// event references, so uploaded maps would never be applied to a stack trace.
				release: { name: version },
				// Symbolication needs these uploaded, not served. Deletion is not gated on the auth
				// token, so a build without one still keeps them out of the deployed site.
				sourcemaps: { filesToDeleteAfterUpload: ['./build/**/*.map'] },
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
		DRAW_SERVICE_PORT: JSON.stringify(process.env.DRAW_SERVICE_PORT || '3030'),
	},
	optimizeDeps: {
		rolldownOptions: {},
		// @testing-library/svelte is excluded so its Svelte components are not pre-bundled.
		// Its CJS grandchild aria-query must still be optimized or Rolldown will not expose
		// its named exports.
		// The collision tests import rapier3d-compat directly. Discovering it mid-run makes
		// Vite re-optimize and reload the test worker, which vitest flags as flaky.
		include: ['@testing-library/svelte > @testing-library/dom', '@dimforge/rapier3d-compat'],
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
			provider: playwright(),
			instances: [{ browser: 'chromium' }],
		},
		clearMocks: true,
		include: ['src/**/*.{test,spec}.{js,ts}'],
		setupFiles: ['./vitest-setup-client.ts'],
	},
})

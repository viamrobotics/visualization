import { defineConfig } from '@playwright/test'
import path from 'node:path'
import url from 'node:url'

const dirname = path.dirname(url.fileURLToPath(import.meta.url))

export default defineConfig({
	globalSetup: path.resolve(dirname, './e2e/helpers/global-setup.ts'),
	webServer: {
		command: 'pnpm dev',
		port: 5173,
		reuseExistingServer: true,
		env: {
			VITE_CONFIGS: '{}',
		},
	},
	use: {
		trace: 'on',
	},
	testDir: 'e2e',
	timeout: 120 * 1000,
	workers: 1,
})

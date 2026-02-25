import { defineConfig } from '@playwright/test'

export default defineConfig({
	webServer: {
		command: 'make up-next',
		port: 5173,
		env: {
			VITE_CONFIGS: '{}',
		},
	},
	use: {
		trace: 'on',
	},
	testDir: 'e2e',
	timeout: 120 * 1000, // 120 seconds
})

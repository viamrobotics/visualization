import { defineConfig } from '@playwright/test'

export default defineConfig({
	webServer: {
		command: 'pnpm run dev',
		port: 5173,
		env: {
			VITE_CONFIGS: '{}',
		},
	},

	testDir: 'e2e',
	timeout: 120 * 1000, // 120 seconds
})

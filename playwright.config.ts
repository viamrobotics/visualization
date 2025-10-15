import { defineConfig } from '@playwright/test'

export default defineConfig({
	webServer: {
		command: 'pnpm run dev',
		port: 5173,
	},

	testDir: 'e2e',
	timeout: 60 * 1000, // 60 seconds
})

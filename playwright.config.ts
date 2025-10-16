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
	timeout: 60 * 1000, // 60 seconds
})

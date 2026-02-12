import { defineConfig } from '@playwright/test'

export default defineConfig({
	webServer: [
		{
			command: 'pnpm dev',
			env: {
				VITE_CONFIGS: '{}',
			},
		},
	],
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on',
	},
	testDir: 'e2e',
	timeout: 120 * 1000, // 120 seconds
})

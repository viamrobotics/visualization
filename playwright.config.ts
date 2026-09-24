import { defineConfig } from '@playwright/test'

const DRAWING_SPECS = [
	/deep-link\.test\.ts$/,
	/draw-client\.test\.ts$/,
	/file-drop\.test\.ts$/,
	/snapshot\.test\.ts$/,
] as const

const MATRIX_SPECS = [/matrix\/.*\.test\.ts$/] as const

const PLAYGROUND_SPECS = [/playground-smoke\.test\.ts$/] as const

const ROBOT_SPECS = [
	/arm\.test\.ts$/,
	/edit-frame\.test\.ts$/,
	/obstacle-store\.test\.ts$/,
	/world-state-store\.test\.ts$/,
] as const

const APP_PORT = 5173

// CI verifies the artifact it would ship, so it serves the static build through
// the same bun server `make up` uses rather than Vite. Baselines are recorded
// against `pnpm dev` and hold either way: the two were measured pixel for pixel
// identical across the drawing and matrix projects. The build itself is a
// separate CI step, so its cost shows up on its own line.
const APP_SERVER = process.env.CI
	? `WS_PORT=3000 STATIC_PORT=${APP_PORT} bun run server/server.ts --production`
	: 'pnpm dev'

export default defineConfig({
	webServer: {
		command: APP_SERVER,
		port: APP_PORT,
		reuseExistingServer: !process.env.CI,
		env: {
			VITE_CONFIGS: '{}',
		},
	},
	use: {
		// Stated rather than left to `webServer.port`, which Playwright only
		// resolves into the context it creates per test. The matrix project builds
		// its own worker-scoped context and reads the base URL off the project.
		baseURL: `http://localhost:${APP_PORT}`,
		trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
	},
	testDir: 'e2e',
	outputDir: 'test-results',
	timeout: 120 * 1000,
	// Measured on an 8-core darwin box: 4 workers cut the drawing project from 451s
	// to 377s but stretched the mean test from 6.4s to 15.6s, which is what pushed
	// one snapshot test past its timeout. 2 keeps most of the gain with less
	// contention. CI runners have 4 vCPUs.
	workers: process.env.CI ? 4 : 2,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI
		? [
				['list'],
				['html', { open: 'never' }],
				['github'],
				// Read by .github/scripts/e2e-failure-fingerprint.js, which decides
				// whether a failure is new enough to be worth a Slack message.
				['json', { outputFile: 'test-results/report.json' }],
			]
		: [['list'], ['html', { open: 'never' }]],
	// Pinned because the built-in template injects {-projectName} into every
	// filename, so naming projects would orphan all committed baselines.
	snapshotPathTemplate:
		'{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{platform}{ext}',
	expect: {
		timeout: 10_000,
		toHaveScreenshot: {
			threshold: 0.1,
			// `threshold` is per-pixel colour tolerance, so without a pixel budget
			// any single differing pixel fails. Every baseline is 1280x720, and the
			// gap between noise and a real mismatch is wide: a settled scene drifts
			// by 2 pixels out of 921,600, while the smallest genuine failure in the
			// suite is 2435. 100 sits well clear of both.
			maxDiffPixels: 100,
			animations: 'disabled',
			caret: 'hide',
		},
	},
	projects: [
		{
			// Each worker owns a draw server, so these specs share no scene state.
			name: 'drawing',
			testMatch: [...DRAWING_SPECS],
			fullyParallel: true,
		},
		{
			// Cells are one or two RPCs and a poll against a page the whole worker
			// shares, so this project parallelizes on RPC latency rather than on
			// page loads the way `drawing` does.
			name: 'matrix',
			testMatch: [...MATRIX_SPECS],
			fullyParallel: true,
		},
		{
			// Runs against the deployed playground rather than a local build, so it
			// is selected through playwright.playground.config.ts, which supplies the
			// deploy's base URL and no webServer.
			name: 'playground',
			testMatch: [...PLAYGROUND_SPECS],
		},
		{
			// Provisioning is its own project so a drawing-only run never pays for a
			// cloud machine. The robot project's dependency is what pulls it in.
			name: 'robot-setup',
			testMatch: /robot\.setup\.ts$/,
			teardown: 'robot-teardown',
			timeout: 5 * 60 * 1000,
		},
		{
			name: 'robot-teardown',
			testMatch: /robot\.teardown\.ts$/,
			timeout: 2 * 60 * 1000,
		},
		{
			// All four specs push conflicting configs at the one shared machine, so they
			// stay serial even once the drawing project goes parallel.
			name: 'robot',
			testMatch: [...ROBOT_SPECS],
			dependencies: ['robot-setup'],
			fullyParallel: false,
		},
	],
})

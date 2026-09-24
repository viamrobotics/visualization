import { defineConfig } from '@playwright/test'

import base from './playwright.config'

/**
 * Runs the `playground` project against the deployed gh-pages playground.
 *
 * Separate from the main config because there is no local build to serve and
 * `webServer` cannot be turned off per project. Everything else runs against a
 * local production build, so this is the only thing still checking that the
 * deploy itself works.
 */
export default defineConfig({
	...base,
	webServer: undefined,
	use: {
		...base.use,
		baseURL: 'https://viamrobotics.github.io/visualization/playground/',
	},
})

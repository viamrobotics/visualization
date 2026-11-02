import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

import { canSelfUpdate } from './canSelfUpdate'

/**
 * Checks GitHub releases for a newer version in the background, downloads it, and installs it when
 * the app quits. Does nothing where {@link canSelfUpdate} is false. Failures are logged only.
 */
export const startAutoUpdate = () => {
	const context = { env: process.env, isPackaged: app.isPackaged, platform: process.platform }
	if (!canSelfUpdate(context)) return

	// A release exists before its bundles are uploaded, so a missing latest.yml is routine. Without
	// a listener, the updater's 'error' event would throw in the main process.
	autoUpdater.on('error', (error) => {
		console.error('auto-update failed:', error)
	})
	// The 'error' listener has already logged the rejection.
	autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)
}

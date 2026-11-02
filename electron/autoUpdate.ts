import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { canSelfUpdate } from './canSelfUpdate'

// electron-updater picks its Linux updater from the same file, read the same way.
const readPackageType = () => {
	try {
		return readFileSync(path.join(process.resourcesPath, 'package-type'), 'utf8').trim()
	} catch {
		return undefined
	}
}

/**
 * Checks GitHub releases for a newer version in the background, downloads it, and installs it when
 * the app quits. Does nothing where {@link canSelfUpdate} is false. Failures are logged only.
 */
export const startAutoUpdate = () => {
	const context = {
		env: process.env,
		isPackaged: app.isPackaged,
		packageType: readPackageType(),
		platform: process.platform,
	}
	if (!canSelfUpdate(context)) return

	// A release exists before its bundles are uploaded, so a missing latest.yml is routine. Without
	// a listener, the updater's 'error' event would throw in the main process.
	autoUpdater.on('error', (error) => {
		console.error('auto-update failed:', error)
	})
	// The 'error' listener has already logged the rejection.
	autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)
}

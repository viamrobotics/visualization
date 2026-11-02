/** The parts of the running process that decide whether it can update itself. */
export interface SelfUpdateContext {
	env: NodeJS.ProcessEnv
	isPackaged: boolean
	platform: NodeJS.Platform
}

/**
 * Whether this install can replace itself with a newer release: a packaged Windows NSIS install or
 * Linux AppImage. macOS updates need a Developer ID signature, which the app does not have.
 * Setting `VIAM_VISUALIZER_NO_AUTO_UPDATE` turns updates off.
 */
export const canSelfUpdate = ({ env, isPackaged, platform }: SelfUpdateContext): boolean => {
	if (!isPackaged || env.VIAM_VISUALIZER_NO_AUTO_UPDATE !== undefined) return false
	// electron-builder's portable target sets this, and electron-updater cannot replace a portable exe.
	if (platform === 'win32') return env.PORTABLE_EXECUTABLE_DIR === undefined
	// The AppImage runtime sets this. A .deb install would need a root prompt to update.
	if (platform === 'linux') return env.APPIMAGE !== undefined
	return false
}

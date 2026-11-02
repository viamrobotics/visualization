/** The parts of the running process that decide whether it can update itself. */
export interface SelfUpdateContext {
	env: NodeJS.ProcessEnv
	isPackaged: boolean
	/** The `package-type` file electron-builder writes into a Linux package's resources. */
	packageType?: string
	platform: NodeJS.Platform
}

/**
 * Whether this install can replace itself with a newer release: a packaged Windows NSIS install,
 * Linux AppImage, or Linux .deb. macOS updates need a Developer ID signature, which the app does
 * not have. Setting `VIAM_VISUALIZER_NO_AUTO_UPDATE` turns updates off.
 */
export const canSelfUpdate = ({
	env,
	isPackaged,
	packageType,
	platform,
}: SelfUpdateContext): boolean => {
	if (!isPackaged || env.VIAM_VISUALIZER_NO_AUTO_UPDATE !== undefined) return false
	// electron-builder's portable target sets this, and electron-updater cannot replace a portable exe.
	if (platform === 'win32') return env.PORTABLE_EXECUTABLE_DIR === undefined
	// The AppImage runtime sets APPIMAGE. A .deb update runs dpkg behind an administrator password prompt.
	if (platform === 'linux') return env.APPIMAGE !== undefined || packageType === 'deb'
	return false
}

import { describe, expect, it } from 'vitest'

import { canSelfUpdate } from '../canSelfUpdate'

describe('canSelfUpdate', () => {
	it('updates a packaged Windows NSIS install', () => {
		expect(canSelfUpdate({ env: {}, isPackaged: true, platform: 'win32' })).toBe(true)
	})

	it('skips the Windows portable exe', () => {
		const env = { PORTABLE_EXECUTABLE_DIR: String.raw`C:\Downloads` }
		expect(canSelfUpdate({ env, isPackaged: true, platform: 'win32' })).toBe(false)
	})

	it('updates a Linux AppImage', () => {
		const env = { APPIMAGE: '/home/me/viam-visualizer.AppImage' }
		expect(canSelfUpdate({ env, isPackaged: true, platform: 'linux' })).toBe(true)
	})

	it('updates a Linux .deb install', () => {
		expect(
			canSelfUpdate({ env: {}, isPackaged: true, packageType: 'deb', platform: 'linux' })
		).toBe(true)
	})

	it('skips a Linux install that is neither an AppImage nor a .deb', () => {
		expect(canSelfUpdate({ env: {}, isPackaged: true, platform: 'linux' })).toBe(false)
		expect(
			canSelfUpdate({ env: {}, isPackaged: true, packageType: 'rpm', platform: 'linux' })
		).toBe(false)
	})

	it('skips macOS, which needs a Developer ID signature to update', () => {
		expect(canSelfUpdate({ env: {}, isPackaged: true, platform: 'darwin' })).toBe(false)
	})

	it('skips an unpackaged run', () => {
		expect(canSelfUpdate({ env: {}, isPackaged: false, platform: 'win32' })).toBe(false)
	})

	it('honors VIAM_VISUALIZER_NO_AUTO_UPDATE', () => {
		const env = { APPIMAGE: '/tmp/a.AppImage', VIAM_VISUALIZER_NO_AUTO_UPDATE: '1' }
		expect(canSelfUpdate({ env, isPackaged: true, platform: 'linux' })).toBe(false)
	})
})

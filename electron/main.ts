import { app, BrowserWindow } from 'electron'
import serve from 'electron-serve'
import path from 'node:path'

// Set by `pnpm electron:dev`. Unset, the window loads the static build in build/.
const devServerUrl = process.env.VIAM_VISUALIZER_DEV_URL

// electron-serve registers its scheme on import-time call, which Electron only accepts before ready.
// The absolute directory keeps it independent of app.getAppPath(), which differs unpackaged.
const loadStaticBuild = devServerUrl
	? undefined
	: serve({ directory: path.join(import.meta.dirname, '..', 'build') })

const createWindow = async () => {
	const window = new BrowserWindow({
		height: 800,
		title: 'Viam Visualizer',
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(import.meta.dirname, 'preload.cjs'),
			sandbox: true,
		},
		width: 1280,
	})

	await (loadStaticBuild ? loadStaticBuild(window) : window.loadURL(devServerUrl ?? ''))
}

// Matches the Tauri shell: closing the window quits on every platform, which is what the CLI's
// foreground launch expects.
app.on('window-all-closed', () => {
	app.quit()
})

void app.whenReady().then(createWindow)

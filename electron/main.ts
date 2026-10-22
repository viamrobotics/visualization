import { app, BrowserWindow, ipcMain } from 'electron'
import serve from 'electron-serve'
import path from 'node:path'

import type { LaunchConfigPayload } from '../src/routes/lib/desktop/launchConfig'
import type { DrawServer } from './drawServer'

import { shouldStartDrawServer, startBundledDrawServer } from './bundledDrawServer'
import {
	DRAW_SERVICE_PORT_CHANNEL,
	LAUNCH_CONFIG_CHANGED_CHANNEL,
	LAUNCH_CONFIG_CHANNEL,
} from './ipcChannels'
import { readLaunchFile, resolveLaunchFile } from './launchFile'
import { launchFileFromSecondInstance, type SecondInstanceData } from './secondInstanceData'

// Unpackaged, Electron names the app and its userData directory after the npm library's
// package.json. Matching productName keeps dev and packaged runs on the same userData.
app.setName('Viam Visualizer')

// Set by `pnpm electron:dev`. Unset, the window loads the static build in build/.
const devServerUrl = process.env.VIAM_VISUALIZER_DEV_URL

// electron-serve registers its scheme when called, which Electron only accepts before ready.
// The absolute directory keeps it independent of app.getAppPath(), which differs unpackaged.
const loadStaticBuild = devServerUrl
	? undefined
	: serve({ directory: path.join(import.meta.dirname, '..', 'build') })

let mainWindow: BrowserWindow | undefined
let launchConfig: LaunchConfigPayload | null = null
let drawServerStartup: Promise<DrawServer | undefined> = Promise.resolve(undefined)
// Kept beside the promise so quitting can stop it synchronously, before the process exits.
let drawServer: DrawServer | undefined

// The renderer may not be listening yet. It asks for the current config once it is, so storing
// before sending is what keeps an early replacement from being lost.
const replaceLaunchConfig = (payload: LaunchConfigPayload) => {
	launchConfig = payload
	mainWindow?.webContents.send(LAUNCH_CONFIG_CHANGED_CHANNEL, payload)
}

const focusMainWindow = () => {
	if (!mainWindow) return
	if (mainWindow.isMinimized()) mainWindow.restore()
	mainWindow.focus()
}

// A packaged build carries its icons in the bundle. An unpackaged run is the stock Electron binary,
// so it shows Electron's icon unless told otherwise. The macOS one is pre-rounded and padded to the
// Dock grid, which the Linux and Windows icon is not.
const resourcesDirectory = path.join(import.meta.dirname, '..', 'electron', 'resources')
const unpackagedIcon = app.isPackaged ? undefined : path.join(resourcesDirectory, 'icon.png')
const unpackagedDockIcon = app.isPackaged
	? undefined
	: path.join(resourcesDirectory, 'icon-macos.png')

const createWindow = async () => {
	mainWindow = new BrowserWindow({
		height: 800,
		icon: unpackagedIcon,
		title: 'Viam Visualizer',
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(import.meta.dirname, 'preload.cjs'),
			sandbox: true,
		},
		width: 1280,
	})
	mainWindow.on('closed', () => {
		mainWindow = undefined
	})

	await (loadStaticBuild ? loadStaticBuild(mainWindow) : mainWindow.loadURL(devServerUrl ?? ''))
}

const startFirstInstance = (launchFile: string | undefined) => {
	if (launchFile) launchConfig = readLaunchFile(launchFile)

	ipcMain.handle(LAUNCH_CONFIG_CHANNEL, () => launchConfig)
	// Waits out startup, so the renderer gets the port rather than a premature null.
	ipcMain.handle(DRAW_SERVICE_PORT_CHANNEL, async () => {
		const server = await drawServerStartup
		return server?.port ?? null
	})

	app.on('second-instance', (_event, _argv, _workingDirectory, additionalData) => {
		const secondLaunchFile = launchFileFromSecondInstance(additionalData)
		if (secondLaunchFile) replaceLaunchConfig(readLaunchFile(secondLaunchFile))
		focusMainWindow()
	})

	// `open -a <app> <file>` delivers the file here, not in argv, and a relaunch through `open`
	// never starts a second instance. This can fire before ready on a cold start.
	app.on('open-file', (event, file) => {
		event.preventDefault()
		replaceLaunchConfig(readLaunchFile(file))
	})

	// Matches the Tauri shell: closing the window quits on every platform, which is what the CLI's
	// foreground launch expects.
	app.on('window-all-closed', () => {
		app.quit()
	})

	// The server also exits when its stdin closes, which covers a crash that skips this.
	app.on('will-quit', () => {
		drawServer?.stop()
	})

	void app.whenReady().then(() => {
		// macOS takes the Dock icon from the app, not the window.
		if (unpackagedDockIcon) app.dock?.setIcon(unpackagedDockIcon)
		if (shouldStartDrawServer()) {
			drawServerStartup = startBundledDrawServer()
			void drawServerStartup.then((server) => {
				drawServer = server
			})
		}
		return createWindow()
	})
}

// The second instance only resolves its path. The running instance reads and deletes the file.
const launchFile = resolveLaunchFile(process.argv, process.cwd())
const secondInstanceData: SecondInstanceData = { launchFile }

if (app.requestSingleInstanceLock(secondInstanceData)) {
	startFirstInstance(launchFile)
} else {
	app.quit()
}

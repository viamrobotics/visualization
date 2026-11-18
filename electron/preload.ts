import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import type { DesktopBridge } from '../src/routes/lib/desktop/desktopBridge'
import type { LaunchConfigPayload } from '../src/routes/lib/desktop/launchConfig'

import {
	DRAW_SERVICE_PORT_CHANNEL,
	LAUNCH_CONFIG_CHANGED_CHANNEL,
	LAUNCH_CONFIG_CHANNEL,
} from './ipcChannels'

const bridge: DesktopBridge = {
	drawServicePort: () => ipcRenderer.invoke(DRAW_SERVICE_PORT_CHANNEL),
	launchConfig: () => ipcRenderer.invoke(LAUNCH_CONFIG_CHANNEL),
	onLaunchConfigChanged: (listener) => {
		const handler = (_event: IpcRendererEvent, payload: LaunchConfigPayload) => listener(payload)
		ipcRenderer.on(LAUNCH_CONFIG_CHANGED_CHANNEL, handler)
		return () => {
			ipcRenderer.off(LAUNCH_CONFIG_CHANGED_CHANNEL, handler)
		}
	},
}

// Its presence also marks the desktop shell for the renderer.
contextBridge.exposeInMainWorld('viamDesktop', bridge)

import { getDesktopBridge } from './desktopBridge'

export interface DrawServicePortState {
	readonly ready: boolean
	readonly port: string | undefined
}

export const useDrawServicePort = (): DrawServicePortState => {
	const bridge = getDesktopBridge()

	let ready = $state(!bridge)
	let port = $state<string | undefined>(undefined)

	if (bridge) {
		bridge
			.drawServicePort()
			.then((payload) => {
				port = payload === null ? undefined : String(payload)
			})
			.catch((error: unknown) => {
				console.warn('Failed to read the draw server port from the desktop shell', error)
			})
			.finally(() => {
				ready = true
			})
	}

	return {
		get ready() {
			return ready
		},
		get port() {
			return port
		},
	}
}

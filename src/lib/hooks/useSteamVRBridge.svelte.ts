import { getContext, setContext } from 'svelte'
import { Vector3, Quaternion } from 'three'

const key = Symbol('steamvr-bridge')

export interface SteamVRController {
	connected: boolean
	position: Vector3
	rotation: Quaternion
	trigger: number
	triggerPressed: boolean
	grip: boolean
	trackpad: [number, number]
	trackpadPressed: boolean
	menu: boolean
}

export interface SteamVRBridgeState {
	status: 'disconnected' | 'connecting' | 'connected'
	left: SteamVRController
	right: SteamVRController
}

function defaultController(): SteamVRController {
	return {
		connected: false,
		position: new Vector3(),
		rotation: new Quaternion(),
		trigger: 0,
		triggerPressed: false,
		grip: false,
		trackpad: [0, 0],
		trackpadPressed: false,
		menu: false,
	}
}

interface BridgeMessage {
	ts: number
	controllers: {
		left: {
			connected: boolean
			pos: [number, number, number]
			rot: [number, number, number, number]
			trigger: number
			triggerPressed: boolean
			grip: boolean
			trackpad: [number, number]
			trackpadPressed: boolean
			menu: boolean
		}
		right: {
			connected: boolean
			pos: [number, number, number]
			rot: [number, number, number, number]
			trigger: number
			triggerPressed: boolean
			grip: boolean
			trackpad: [number, number]
			trackpadPressed: boolean
			menu: boolean
		}
	}
}

function applyMessage(target: SteamVRController, src: BridgeMessage['controllers']['left']) {
	target.connected = src.connected
	target.position.set(src.pos[0], src.pos[1], src.pos[2])
	target.rotation.set(src.rot[0], src.rot[1], src.rot[2], src.rot[3])
	target.trigger = src.trigger
	target.triggerPressed = src.triggerPressed
	target.grip = src.grip
	target.trackpad = src.trackpad
	target.trackpadPressed = src.trackpadPressed
	target.menu = src.menu
}

interface Context {
	readonly state: SteamVRBridgeState
	connect: (host: string, port: number) => void
	disconnect: () => void
}

export const provideSteamVRBridge = () => {
	let state = $state<SteamVRBridgeState>({
		status: 'disconnected',
		left: defaultController(),
		right: defaultController(),
	})

	let ws: WebSocket | null = null
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null
	let reconnectDelay = 200
	let shouldReconnect = false
	let currentHost = 'localhost'
	let currentPort = 9090

	function cleanup() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer)
			reconnectTimer = null
		}
		if (ws) {
			ws.onopen = null
			ws.onclose = null
			ws.onerror = null
			ws.onmessage = null
			ws.close()
			ws = null
		}
	}

	function scheduleReconnect() {
		if (!shouldReconnect) return
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null
			doConnect()
		}, reconnectDelay)
		reconnectDelay = Math.min(reconnectDelay * 1.5, 5000)
	}

	function doConnect() {
		cleanup()
		state.status = 'connecting'

		const url = `ws://${currentHost}:${currentPort}`
		ws = new WebSocket(url)

		ws.onopen = () => {
			state.status = 'connected'
			reconnectDelay = 200
			console.log(`[SteamVR Bridge] Connected to ${url}`)
		}

		ws.onmessage = (event) => {
			try {
				const msg: BridgeMessage = JSON.parse(event.data as string)
				applyMessage(state.left, msg.controllers.left)
				applyMessage(state.right, msg.controllers.right)
			} catch {
				// Ignore malformed messages
			}
		}

		ws.onclose = () => {
			state.status = 'disconnected'
			console.log('[SteamVR Bridge] Disconnected')
			scheduleReconnect()
		}

		ws.onerror = (e) => {
			console.warn('[SteamVR Bridge] Error:', e)
			ws?.close()
		}
	}

	function connect(host: string, port: number) {
		currentHost = host
		currentPort = port
		shouldReconnect = true
		reconnectDelay = 200
		doConnect()
	}

	function disconnect() {
		shouldReconnect = false
		cleanup()
		state.status = 'disconnected'
		state.left = defaultController()
		state.right = defaultController()
	}

	const context: Context = {
		get state() {
			return state
		},
		connect,
		disconnect,
	}

	setContext<Context>(key, context)
	return context
}

export const useSteamVRBridge = (): Context => {
	return getContext<Context>(key)
}

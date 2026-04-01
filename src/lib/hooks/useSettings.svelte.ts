import { get, set } from 'idb-keyval'
import { getContext, setContext } from 'svelte'

const key = Symbol('dashboard-context')

export interface Settings {
	cameraMode: 'orthographic' | 'perspective'
	interactionMode: 'navigate' | 'measure' | 'lasso'
	refreshRates: {
		poses: number
		pointclouds: number
		vision: number
	}

	disabledCameras: Record<string, boolean>
	disabledVisionServices: Record<string, boolean>

	// Transform controls
	transforming: boolean
	snapping: boolean
	transformMode: 'translate' | 'rotate' | 'scale'

	// Grid
	grid: boolean
	gridCellSize: number
	gridSectionSize: number
	gridFadeDistance: number

	// Points
	pointSize: number
	pointColor: string

	// Lines
	lineWidth: number
	lineDotSize: number

	// Measurement
	enableMeasureAxisX: boolean
	enableMeasureAxisY: boolean
	enableMeasureAxisZ: boolean

	enableLabels: boolean
	enableKeybindings: boolean
	enableQueryDevtools: boolean

	// Widgets
	enableArmPositionsWidget: boolean
	openCameraWidgets: Record<string, string[]>

	renderStats: boolean
	renderArmModels: 'colliders' | 'colliders+model' | 'model'
	renderSubEntityHoverDetail: boolean

	// Webxr
	enableXR: boolean
	xrMode: 'frame-configure' | 'arm-teleop'
	xrController: {
		left: {
			armName?: string
			gripperName?: string
			scaleFactor: number
			rotationEnabled: boolean
		}
		right: {
			armName?: string
			gripperName?: string
			scaleFactor: number
			rotationEnabled: boolean
		}
	}
}

interface Context {
	current: Settings
	isLoaded: boolean
	merge(value: Settings): void
}

export const RefreshRates = {
	poses: 'poses',
	pointclouds: 'pointclouds',
	vision: 'vision',
} as const

const defaults = (): Settings => ({
	cameraMode: 'perspective',

	refreshRates: {
		poses: 1000,
		pointclouds: 5000,
		vision: 1000,
	},

	disabledCameras: {},
	disabledVisionServices: {},

	transforming: false,
	snapping: false,
	transformMode: 'translate',

	grid: true,
	gridCellSize: 0.5,
	gridSectionSize: 10,
	gridFadeDistance: 25,

	pointSize: 0.01,
	pointColor: '#333333',

	lineWidth: 0.005,
	lineDotSize: 0.01,

	interactionMode: 'navigate',

	enableMeasureAxisX: true,
	enableMeasureAxisY: true,
	enableMeasureAxisZ: true,

	enableLabels: false,
	enableKeybindings: true,
	enableQueryDevtools: false,

	enableArmPositionsWidget: false,
	openCameraWidgets: {},

	renderStats: false,
	renderArmModels: 'colliders+model',
	renderSubEntityHoverDetail: false,

	enableXR: false,
	xrMode: 'frame-configure',
	xrController: {
		left: {
			scaleFactor: 1,
			rotationEnabled: true,
		},
		right: {
			scaleFactor: 1,
			rotationEnabled: true,
		},
	},
})

export const provideSettings = () => {
	let isLoaded = $state(false)
	let settings = $state<Settings>(defaults())

	get('motion-tools-settings')
		.then((response: Settings) => {
			if (response) {
				settings = { ...settings, ...response }
			}
		})
		.finally(() => {
			isLoaded = true
		})

	$effect(() => {
		if (isLoaded) {
			set('motion-tools-settings', $state.snapshot({ ...settings, interactionMode: 'navigate' }))
		}
	})

	const context: Context = {
		get current() {
			return settings
		},
		set current(value: Settings) {
			settings = value
		},
		get isLoaded() {
			return isLoaded
		},
		merge(value: Settings) {
			settings = { ...settings, ...value }
		},
	}

	setContext<Context>(key, context)

	return context
}

export const useSettings = () => {
	return getContext<Context>(key)
}

import { get, set } from 'idb-keyval'
import { getContext, setContext } from 'svelte'

const key = Symbol('dashboard-context')

export interface Settings {
	isLoaded: boolean
	// Camera
	cameraMode: 'orthographic' | 'perspective'

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

	interactionMode: 'navigate' | 'measure' | 'lasso'

	// Measurement
	enableMeasureAxisX: boolean
	enableMeasureAxisY: boolean
	enableMeasureAxisZ: boolean

	enableLabels: boolean
	enableKeybindings: boolean
	enableQueryDevtools: boolean

	// AR Mode
	enableXR: boolean

	// Widgets
	enableArmPositionsWidget: boolean
	openCameraWidgets: Record<string, string[]>

	renderStats: boolean
	renderArmModels: 'colliders' | 'colliders+model' | 'model'
	renderSubEntityHoverDetail: boolean

	// XR Controller Configuration
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
}

const defaults = (): Settings => ({
	isLoaded: false,
	cameraMode: 'perspective',

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

	enableXR: false,

	enableArmPositionsWidget: false,
	openCameraWidgets: {},

	renderStats: false,
	renderArmModels: 'colliders+model',
	renderSubEntityHoverDetail: false,

	xrController: {
		left: {
			scaleFactor: 1.0,
			rotationEnabled: true,
		},
		right: {
			scaleFactor: 1.0,
			rotationEnabled: true,
		},
	},
})

export const provideSettings = () => {
	let settings = $state<Settings>(defaults())
	let settingsLoaded = $state(false)

	get('motion-tools-settings').then((response: Settings) => {
		if (response) {
			settings = { ...settings, ...response }
		}
		settingsLoaded = true
		settings.isLoaded = true
	})

	$effect(() => {
		if (settingsLoaded) {
			set('motion-tools-settings', $state.snapshot(settings))
		}
	})

	const context: Context = {
		get current() {
			return settings
		},

		set current(value: Settings) {
			settings = value
		},
	}

	setContext<Context>(key, context)

	return context
}

export const useSettings = () => {
	return getContext<Context>(key)
}

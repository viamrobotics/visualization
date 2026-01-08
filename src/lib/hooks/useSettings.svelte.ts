import { get, set } from 'idb-keyval'
import { getContext, setContext } from 'svelte'

const key = Symbol('dashboard-context')

export interface Settings {
	revision: number

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

	enableMeasure: boolean
	enableLabels: boolean
	enableKeybindings: boolean
	enableQueryDevtools: boolean

	// AR Mode
	enableXR: boolean

	// Widgets
	enableArmPositionsWidget: boolean

	renderStats: boolean
	renderArmModels: 'colliders' | 'colliders+model' | 'model'
}

interface Context {
	current: Settings
}

const defaults = (): Settings => ({
	revision: 2,
	cameraMode: 'perspective',

	transforming: false,
	snapping: false,
	transformMode: 'translate',

	grid: true,
	gridCellSize: 500,
	gridSectionSize: 10_000,
	gridFadeDistance: 25_000,

	pointSize: 10,
	pointColor: '#333333',

	lineWidth: 5,
	lineDotSize: 10,

	enableMeasure: false,
	enableLabels: false,
	enableKeybindings: true,
	enableQueryDevtools: false,

	enableXR: false,

	enableArmPositionsWidget: false,

	renderStats: false,
	renderArmModels: 'colliders+model',
})

export const provideSettings = () => {
	let settings = $state<Settings>(defaults())
	let settingsLoaded = $state(false)

	get('motion-tools-settings').then((response: Settings) => {
		if (response && response.revision === settings.revision) {
			settings = { ...settings, ...response }
		}

		settingsLoaded = true
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

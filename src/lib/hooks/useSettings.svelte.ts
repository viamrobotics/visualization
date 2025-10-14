import { get, set } from 'idb-keyval'
import { getContext, setContext } from 'svelte'

const key = Symbol('dashboard-context')

interface Settings {
	// viewer mode
	viewerMode: 'edit' | 'monitor'
	isStandalone: boolean
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
}

interface Context {
	current: Settings
}

const defaults = (): Settings => ({
	viewerMode: 'monitor',
	isStandalone: true,
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

	enableMeasure: false,
	enableLabels: false,
	enableKeybindings: true,
	enableQueryDevtools: false,

	enableXR: false,

	enableArmPositionsWidget: false,

	renderStats: false,
})

export const provideSettings = () => {
	let settings = $state<Settings>(defaults())

	get('motion-tools-settings').then((response: Settings) => {
		if (response) {
			settings = { ...settings, ...response }
		}
	})

	$effect(() => {
		set('motion-tools-settings', $state.snapshot(settings))
	})

	const context: Context = {
		get current() {
			return settings
		},
	}

	setContext<Context>(key, context)

	return context
}

export const useSettings = () => {
	return getContext<Context>(key)
}

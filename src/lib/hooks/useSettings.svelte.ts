import type { ColorRepresentation } from 'three'

import { get, set } from 'idb-keyval'
import { getContext, setContext } from 'svelte'

import type { RenderMode } from '$lib/three/surfaceShading'

import {
	migrateStoredSettings,
	SETTINGS_MIGRATION_COUNT,
	type StoredSettings,
} from './settingsMigrations'

const key = Symbol('dashboard-context')

export interface Settings {
	anthropicKey: string
	cameraMode: 'orthographic' | 'perspective'
	cameraSmoothTime: number
	cameraDraggingSmoothTime: number
	enableDollyToCursor: boolean
	interactionMode: 'navigate' | 'measure' | 'select' | 'gizmo' | 'move'
	refreshRates: {
		poses: number
		pointclouds: number
		vision: number
	}

	disabledCameras: Record<string, boolean>
	disabledVisionServices: Record<string, boolean>

	snapping: boolean
	snapTranslate: number
	snapRotate: number
	snapScale: number
	transformMode: 'none' | 'translate' | 'rotate' | 'scale'
	transformSpace: 'local' | 'world'

	grid: boolean
	gridCellSize: number
	gridSectionSize: number
	gridFadeDistance: number

	pointSize: number
	pointColor: ColorRepresentation
	/** Max points drawn across all clouds while the camera moves. 0 draws every point. */
	pointBudget: number
	/** Ceiling on a point's on-screen diameter, in CSS pixels. */
	maxPointSize: number

	lineWidth: number
	lineDotSize: number

	enableMeasureAxisX: boolean
	enableMeasureAxisY: boolean
	enableMeasureAxisZ: boolean

	enableLabels: boolean

	openFramePovWidgets: Record<string, string[]>

	renderStats: boolean
	renderArmModels: 'colliders' | 'colliders+model' | 'model'
	/** How entity surfaces are shaded. `realistic` is the only mode that casts shadows. */
	renderMode: RenderMode

	enableXR: boolean
	xrMode: 'frame-configure' | 'arm-teleop'
	xrCameras: string[]
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

export type RefreshRateId = keyof Settings['refreshRates']

const DEFAULT_REFRESH_RATES: Settings['refreshRates'] = {
	poses: 1000,
	pointclouds: 5000,
	vision: 1000,
}

const defaults = (): Settings => ({
	anthropicKey: '',
	cameraMode: 'perspective',
	cameraSmoothTime: 0.05,
	cameraDraggingSmoothTime: 0.05,
	enableDollyToCursor: false,

	refreshRates: { ...DEFAULT_REFRESH_RATES },

	disabledCameras: {},
	disabledVisionServices: {},

	snapping: false,
	snapTranslate: 0.1,
	snapRotate: 7.5,
	snapScale: 0.1,
	transformMode: 'none',
	transformSpace: 'world',

	grid: true,
	gridCellSize: 0.5,
	gridSectionSize: 10,
	gridFadeDistance: 25,

	pointSize: 0.01,
	pointColor: '#333333',
	pointBudget: 800_000,
	maxPointSize: 32,

	lineWidth: 0.005,
	lineDotSize: 0.005,

	interactionMode: 'navigate',

	enableMeasureAxisX: true,
	enableMeasureAxisY: true,
	enableMeasureAxisZ: true,

	enableLabels: false,

	openFramePovWidgets: {},

	renderStats: false,
	renderArmModels: 'colliders+model',
	renderMode: 'realistic',

	enableXR: false,
	xrMode: 'frame-configure',
	xrCameras: [],
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

	// Key kept as `motion-tools-settings` after the rename to visualization; renaming it
	// would silently discard every existing user's saved settings.
	get<StoredSettings>('motion-tools-settings')
		.then((response) => {
			if (response) {
				settings = { ...settings, ...migrateStoredSettings(response) }
			}
		})
		.finally(() => {
			isLoaded = true
		})

	// A record is stamped with the migration count on the way out, so the next load
	// runs only what it has not seen. A user with no stored record never runs one,
	// because `defaults()` is already current.
	$effect(() => {
		if (isLoaded) {
			set(
				'motion-tools-settings',
				$state.snapshot({
					...settings,
					interactionMode: 'navigate',
					migrationsApplied: SETTINGS_MIGRATION_COUNT,
				})
			)
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

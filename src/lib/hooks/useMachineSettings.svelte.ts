import { get, set } from 'idb-keyval'
import { getContext, setContext } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'

const key = Symbol('polling-rate-context')
const refreshRatesKey = 'polling-rate'
const disabledCamerasKey = 'disabled-cameras'
const disabledVisionServicesKey = 'disabled-vision-services-object-pointcloud'

export const RefreshRates = {
	poses: 'poses',
	pointclouds: 'pointclouds',
	vision: 'vision',
} as const

type Context = {
	refreshRates: SvelteMap<string, number>
	disabledCameras: SvelteMap<string, boolean>
	disabledVisionServices: SvelteMap<string, boolean>
}

const setFromEntries = (map: SvelteMap<string, unknown>, entries?: [string, unknown][]) => {
	if (entries) {
		for (const [key, value] of entries) {
			map.set(key, value)
		}
	}
}

export const provideMachineSettings = () => {
	const refreshRates = new SvelteMap<string, number>([
		[RefreshRates.poses, 1000],
		[RefreshRates.pointclouds, 5000],
		[RefreshRates.vision, 5000],
	])
	const disabledCameras = new SvelteMap<string, boolean>()
	const disabledVisionServices = new SvelteMap<string, boolean>()

	get(refreshRatesKey).then((entries) => {
		setFromEntries(refreshRates, entries)
	})

	get(disabledCamerasKey).then((entries) => {
		setFromEntries(disabledCameras, entries)
	})

	get(disabledVisionServicesKey).then((entries) => {
		setFromEntries(disabledVisionServices, entries)
	})

	$effect(() => {
		set(refreshRatesKey, [...refreshRates.entries()])
	})

	$effect(() => {
		set(disabledCamerasKey, [...disabledCameras.entries()])
	})

	$effect(() => {
		set(disabledVisionServicesKey, [...disabledVisionServices.entries()])
	})

	setContext<Context>(key, {
		get refreshRates() {
			return refreshRates
		},
		get disabledCameras() {
			return disabledCameras
		},
		get disabledVisionServices() {
			return disabledVisionServices
		},
	})
}

export const useMachineSettings = (): Context => {
	return getContext<Context>(key)
}

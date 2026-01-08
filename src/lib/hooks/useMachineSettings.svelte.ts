import { get, set } from 'idb-keyval'
import { getContext, setContext } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'

const key = Symbol('polling-rate-context')
const refreshRatesKey = 'polling-rate'
const disabledCamerasKey = 'disabled-cameras'
const disabledVisionServicesObjectPointcloudsKey = 'disabled-vision-services-object-pointcloud'

export const RefreshRates = {
	poses: 'poses',
	pointclouds: 'pointclouds',
} as const

type Context = {
	refreshRates: SvelteMap<string, number>
	disabledCameras: SvelteMap<string, boolean>
	disabledVisionServicesObjectPointclouds: SvelteMap<string, boolean>
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
		[RefreshRates.pointclouds, -1],
	])
	const disabledCameras = new SvelteMap<string, boolean>()
	const disabledVisionServicesObjectPointclouds = new SvelteMap<string, boolean>()

	get(refreshRatesKey).then((entries) => {
		setFromEntries(refreshRates, entries)
	})

	get(disabledCamerasKey).then((entries) => {
		setFromEntries(disabledCameras, entries)
	})

	get(disabledVisionServicesObjectPointcloudsKey).then((entries) => {
		setFromEntries(disabledVisionServicesObjectPointclouds, entries)
	})

	$effect(() => {
		set(refreshRatesKey, [...refreshRates.entries()])
	})

	$effect(() => {
		set(disabledCamerasKey, [...disabledCameras.entries()])
	})

	setContext<Context>(key, {
		get refreshRates() {
			return refreshRates
		},
		get disabledCameras() {
			return disabledCameras
		},
		get disabledVisionServicesObjectPointclouds() {
			return disabledVisionServicesObjectPointclouds
		},
	})
}

export const useMachineSettings = (): Context => {
	return getContext<Context>(key)
}

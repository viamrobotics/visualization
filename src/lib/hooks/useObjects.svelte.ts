import { getContext, setContext } from 'svelte'
import { useFrames } from './useFrames.svelte'
import { useGeometries } from './useGeometries.svelte'
import { useStaticGeometries } from './useStaticGeometries.svelte'
import { useDrawAPI } from './useDrawAPI.svelte'
import { usePointClouds } from './usePointclouds.svelte'
import type { WorldObject } from '$lib/WorldObject.svelte'

const key = Symbol('objects-context')

interface Context {
	current: WorldObject[]
}

export const provideObjects = () => {
	const frames = useFrames()
	const geometries = useGeometries()
	const statics = useStaticGeometries()
	const drawAPI = useDrawAPI()
	const points = usePointClouds()

	const objects = $derived<WorldObject[]>([
		...frames.current,
		...geometries.current,
		...points.current,
		...statics.current,
		...drawAPI.meshes,
		...drawAPI.models,
		...drawAPI.nurbs,
		...drawAPI.points,
		...drawAPI.lines,
		...drawAPI.poses,
	])

	setContext<Context>(key, {
		get current() {
			return objects
		},
	})
}

export const useObjects = (): Context => {
	return getContext<Context>(key)
}

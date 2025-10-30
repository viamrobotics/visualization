import { getContext, setContext } from 'svelte'
import { get, set } from 'idb-keyval'
import { Debounced } from 'runed'
import { createGeometry } from '$lib/geometry'
import { WorldObject } from '$lib/WorldObject.svelte'

const key = Symbol('static-geometries-context')

interface Context {
	current: WorldObject[]
	add: () => void
	remove: (name: string) => void
}

export const provideStaticGeometries = () => {
	let geometries = $state<WorldObject[]>([])
	let loaded = $state(false)

	const debounced = new Debounced(() => geometries, 500)

	get('static-geometries').then((response) => {
		if (Array.isArray(response)) {
			for (const json of response) {
				geometries.push(new WorldObject().fromJSON(json))
			}
		}

		loaded = true
	})

	$effect(() => {
		if (!loaded) return

		const results = []

		for (const geometry of debounced.current) {
			results.push(geometry.toJSON())
		}

		console.log('hi', results)
		set('static-geometries', results)
	})

	setContext<Context>(key, {
		get current() {
			return geometries
		},
		add() {
			const object = new WorldObject(
				`custom geometry ${geometries.length + 1}`,
				undefined,
				undefined,
				createGeometry({
					case: 'box',
					value: { dimsMm: { x: 100, y: 100, z: 100 } },
				})
			)

			geometries.push(object)
		},
		remove(name: string) {
			const index = geometries.findIndex((geo) => geo.name === name)
			geometries.splice(index, 1)
		},
	})
}

export const useStaticGeometries = (): Context => {
	return getContext<Context>(key)
}

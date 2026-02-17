import { ArmClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'
import { useSettings } from './useSettings.svelte'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import type { Group } from 'three'
import { useGeometries } from './useGeometries.svelte'

const gltfLoader = new GLTFLoader()
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
gltfLoader.setDRACOLoader(dracoLoader)

const key = Symbol('3d-models-context')

interface Context {
	current: Record<string, Record<string, Group>>
}

export const provide3DModels = (partID: () => string) => {
	const settings = useSettings()
	let current = $state<Record<string, Record<string, Group>>>({})

	const { queries: geometriesQueries } = useGeometries()

	const shouldFetchModels = $derived(
		settings.current.isLoaded && settings.current.renderArmModels.includes('model')
	)

	const arms = useResourceNames(partID, 'arm')
	const clients = $derived(
		shouldFetchModels
			? arms.current
					.filter((arm) => geometriesQueries.current[arm.name]?.data?.length ?? 0 > 0)
					.map(
						(arm) => [arm.name, createResourceClient(ArmClient, partID, () => arm.name)] as const
					)
			: []
	)

	const queries = $derived(
		clients.map(([name, client]) => {
			const geometries = geometriesQueries.current[name]?.data
			const geometryLabel = geometries?.[0].label
			const prefix = geometryLabel?.split(':')[0] ?? ''

			return [name, prefix, createResourceQuery(client, 'get3DModels')] as const
		})
	)

	$effect(() => {
		for (const [name, prefix, query] of queries) {
			if (!(prefix in current)) {
				current[prefix] = {}
			}

			$effect(() => {
				const models = query.data

				if (!models) return

				for (const [id, model] of Object.entries(models)) {
					const arrayBuffer = model.mesh.buffer.slice(
						model.mesh.byteOffset,
						model.mesh.byteOffset + model.mesh.byteLength
					)

					gltfLoader.parseAsync(arrayBuffer as ArrayBuffer, '').then((result) => {
						current[prefix][id] = result.scene
					})
				}
			})
		}
	})

	$effect(() => {
		const fetch3DModels = async () => {
			const next: Record<string, Record<string, Group>> = {}
			for (const [name, client] of clients) {
				if (!client.current) continue

				try {
					const geometries = geometriesQueries.current[arm]
					if (geometries.length === 0) {
						continue
					}
					const geometryLabel = geometries[0].label
					const prefix = geometryLabel.split(':')[0]
					const models = await client.current.get3DModels()
					if (!(prefix in next)) {
						next[prefix] = {}
					}
					for (const [id, model] of Object.entries(models)) {
						const arrayBuffer = model.mesh.buffer.slice(
							model.mesh.byteOffset,
							model.mesh.byteOffset + model.mesh.byteLength
						)
						const gltfModel = await gltfLoader.parseAsync(arrayBuffer as ArrayBuffer, '')
						next[prefix][id] = gltfModel.scene
					}
					current = next
				} catch (error) {
					// some arms may not implement this api yet
					console.warn(`${client.current.name} returned an error: ${error} when getting 3D models`)
				}
			}
		}

		if (shouldFetchModels) {
			fetch3DModels()
		}
	})

	setContext<Context>(key, {
		get current() {
			return current
		},
	})
}

export const use3DModels = () => {
	return getContext<Context>(key)
}

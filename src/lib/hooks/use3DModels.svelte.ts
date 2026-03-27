import type { Group } from 'three'

import { isInstanceOf } from '@threlte/core'
import { ArmClient } from '@viamrobotics/sdk'
import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { useSettings } from './useSettings.svelte'

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
	let current = $state.raw<Record<string, Record<string, Group>>>({})

	const arms = useResourceNames(partID, 'arm')
	const armClients = $derived(
		arms.current.map((arm) => createResourceClient(ArmClient, partID, () => arm.name))
	)
	const clients = $derived(
		armClients.filter((client) => {
			return arms.current.some((arm) => arm.name === client.current?.name)
		})
	)

	const fetch3DModels = async () => {
		const next: Record<string, Record<string, Group>> = {}
		for (const client of clients) {
			if (!client.current) continue
			try {
				const geometries = await client.current.getGeometries()
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

					gltfModel.scene.traverse((object) => {
						if (isInstanceOf(object, 'Mesh')) {
							const { material } = object

							if (isInstanceOf(material, 'MeshStandardMaterial')) {
								material.roughness = 0.3
								material.metalness = 0.1
							}
						}
					})
				}
				current = next
			} catch (error) {
				// some arms may not implement this api yet
				console.warn(`${client.current.name} returned an error: ${error} when getting 3D models`)
			}
		}
	}

	$effect(() => {
		const shouldFetchModels =
			settings.isLoaded && settings.current.renderArmModels.includes('model')

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

import { ArmClient } from '@viamrobotics/sdk'
import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'
import { useWeblabs, WEBLABS_EXPERIMENTS } from './useWeblabs.svelte'
import { useSettings } from './useSettings.svelte'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import type { Group } from 'three'

const gltfLoader = new GLTFLoader()
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
gltfLoader.setDRACOLoader(dracoLoader)

const key = Symbol('3d-models-context')

interface Context {
	current: Record<string, Record<string, Group>>
}

export const provide3DModels = (partID: () => string) => {
    const weblabs = useWeblabs()
    const settings = useSettings()
	const current = $state.raw<Record<string, Record<string, Group>>>({})

    const arms = useResourceNames(partID, 'arm')
    const armClients = $derived(
        arms.current.map((arm) => createResourceClient(ArmClient, partID, () => arm.name))
    )
    const clients = $derived(
        armClients.filter((client) => {
            return arms.current.some((arm) => arm.name === client.current?.name)
        })
    )

    $effect(() => {
        const fetch3DModels = async () => {
            for (const client of clients) {
                if (!client.current) continue
                try {
                    const models = await client.current.get3DModels()
                    if (!(client.current.name in current)) {
                        current[client.current.name] = {}
                    }
                    for (const [id, model] of Object.entries(models)) {
                        const arrayBuffer = model.mesh.buffer.slice(model.mesh.byteOffset, model.mesh.byteOffset + model.mesh.byteLength)
                        const gltfModel = await gltfLoader.parseAsync(arrayBuffer as ArrayBuffer, '')
                        current[client.current.name][id] = gltfModel.scene
                    }
                } catch (error) {
                    // some arms may not implement this api yet
                    console.warn(`${client.current.name} returned an error: ${error} when getting 3D models`)
                }
            }
        }

        const shouldFetchModels = settings.current.isLoaded && (settings.current.renderArmModels === 'model' || settings.current.renderArmModels === 'colliders+model')
        if (weblabs.isActive(WEBLABS_EXPERIMENTS.MOTION_TOOLS_RENDER_ARM_MODELS) && shouldFetchModels) {
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
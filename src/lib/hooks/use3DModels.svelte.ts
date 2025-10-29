import { ArmClient, Geometry } from '@viamrobotics/sdk'
import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('3d-models-context')

interface Context {
	current: Record<string, Record<string, Geometry>>
}

export const provide3DModels = (partID: () => string) => {
	const current = $state.raw<Record<string, Record<string, Geometry>>>({})
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
						current[client.current.name][id] = new Geometry({
							geometryType: {
								case: 'mesh',
								value: model,
							},
						})
					}
				} catch (error) {
					// some arms may not implement this api yet
					console.warn(`${client.current.name} does not implement get3DModels`)
				}
			}
		}
		fetch3DModels()
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

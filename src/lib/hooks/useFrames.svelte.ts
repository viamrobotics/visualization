import { MachineConnectionEvent, Transform } from '@viamrobotics/sdk'
import {
	createRobotQuery,
	useConnectionStatus,
	useMachineStatus,
	useRobotClient,
} from '@viamrobotics/svelte-sdk'
import { type ConfigurableTrait, type Entity } from 'koota'
import { getContext, setContext, untrack } from 'svelte'

import { resourceNameToColor, subtypeToColor } from '$lib/color'
import { traits, useWorld } from '$lib/ecs'
import { setParentTrait, updateGeometryTrait } from '$lib/ecs/traits'
import { createPose } from '$lib/transform'

import { useConfigFrames } from './useConfigFrames.svelte'
import { useEnvironment } from './useEnvironment.svelte'
import { useLogs } from './useLogs.svelte'
import { usePartConfig } from './usePartConfig.svelte'
import { useResourceByName } from './useResourceByName.svelte'

interface FramesContext {
	current: Transform[]
}

const key = Symbol('frames-context')

export const provideFrames = (partID: () => string) => {
	const configFrames = useConfigFrames()
	const partConfig = usePartConfig()
	const environment = useEnvironment()
	const world = useWorld()
	const resourceByName = useResourceByName()
	const client = useRobotClient(partID)
	const connectionStatus = useConnectionStatus(partID)
	const machineStatus = useMachineStatus(partID)
	const logs = useLogs()

	const pendingSaveKey = $derived(`viam-pending-save-revision:${partID()}`)

	let didRecentlyEdit = $state(false)

	const isEditMode = $derived(environment.current.viewerMode === 'edit')
	const query = createRobotQuery(client, 'frameSystemConfig', () => ({
		refetchOnWindowFocus: false,
		enabled: partID() !== '' && !isEditMode,
	}))

	const revision = $derived(machineStatus.current?.config?.revision)

	$effect(() => {
		if (query.isFetching) {
			logs.add('Fetching frames...')
		} else if (query.error) {
			logs.add(`Frames: ${query.error.message}`, 'error')
		}
	})

	const frames = $derived.by(() => {
		const frames: Record<string, Transform> = {}

		if (!partConfig.hasPendingSave) {
			for (const { frame } of query.data ?? []) {
				if (frame === undefined) {
					continue
				}

				frames[frame.referenceFrame] = frame
			}
		}

		// Let config frames take priority if the user has made edits,
		// has a pending save, or is disconnected
		if (
			didRecentlyEdit ||
			partConfig.hasPendingSave ||
			connectionStatus.current === MachineConnectionEvent.DISCONNECTED
		) {
			const mergedFrames = {
				...frames,
				...configFrames.current,
			}

			/**
			 * Remove frames that have just been deleted locally for optimistic updates,
			 * or frames that have been removed by fragment overrides
			 */
			for (const name of configFrames.unsetFrames) {
				delete mergedFrames[name]
			}

			return mergedFrames
		}

		/**
		 * If we haven't edited and we have a robot connection,
		 * we only use frames reported by the machine
		 */
		return frames
	})

	const current = $derived(Object.values(frames))

	const entities = new Map<string, Entity | undefined>()

	$effect.pre(() => {
		if (revision) {
			untrack(() => query.refetch())
		}
	})

	$effect(() => {
		const key = pendingSaveKey
		const storedRevision = sessionStorage.getItem(key)

		if (!storedRevision) {
			return
		}

		if (!revision) {
			if (!partConfig.hasPendingSave) {
				partConfig.setPendingSave()
			}
			return
		}

		if (revision === storedRevision) {
			if (!partConfig.hasPendingSave) {
				partConfig.setPendingSave()
			}
			return
		}

		sessionStorage.removeItem(key)
		partConfig.clearPendingSave()
		didRecentlyEdit = true
	})

	$effect(() => {
		if (partConfig.hasPendingSave && revision) {
			sessionStorage.setItem(pendingSaveKey, revision)
		}
	})

	const componentSubtypeByName = $derived.by(() => {
		const result: Record<string, string> = {}
		for (const { name, api } of partConfig.current.components ?? []) {
			if (api) {
				const subtype = api.split(':').at(-1)
				if (subtype) {
					result[name] = subtype
				}
			}
		}
		return result
	})

	$effect(() => {
		if (isEditMode) {
			didRecentlyEdit = true
		}
	})

	$effect.pre(() => {
		const currentResourcesByName = resourceByName.current
		const currentPartID = partID()
		const currentComponentSubtypeByName = componentSubtypeByName

		// We only want to update whenever "current" or "resourceByName.current" changes
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		current.length

		untrack(() => {
			const active: Record<string, boolean> = {}

			for (const frame of current) {
				const name = frame.referenceFrame
				const entityKey = `${currentPartID}:${name}`
				active[entityKey] = true

				const parent = frame.poseInObserverFrame?.referenceFrame
				const pose = createPose(frame.poseInObserverFrame?.pose)

				const center = frame.physicalObject?.center
					? createPose(frame.physicalObject.center)
					: undefined
				const resourceName = currentResourcesByName[frame.referenceFrame]
				const color =
					resourceNameToColor(resourceName) ??
					subtypeToColor(currentComponentSubtypeByName[frame.referenceFrame])

				const existing = entities.get(entityKey)

				if (existing) {
					setParentTrait(existing, parent)

					if (color) {
						existing.set(traits.Color, color)
					}

					if (center) {
						existing.set(traits.Center, center)
					}

					updateGeometryTrait(existing, frame.physicalObject)

					existing.set(traits.EditedPose, pose)

					continue
				}

				const entityTraits: ConfigurableTrait[] = [
					traits.Name(name),
					traits.Pose(pose),
					traits.EditedPose(pose),
					traits.FramesAPI,
					traits.ShowAxesHelper,
				]

				if (parent && parent !== 'world') {
					entityTraits.push(traits.Parent(parent))
				}

				if (color) {
					entityTraits.push(traits.Color(color))
				}

				if (center) {
					entityTraits.push(traits.Center(center))
				}

				if (frame.physicalObject) {
					entityTraits.push(traits.Geometry(frame.physicalObject))
				}

				const entity = world.spawn(...entityTraits)

				entities.set(entityKey, entity)
			}

			// Clean up non-active entities
			for (const [entityKey, entity] of entities) {
				if (!active[entityKey]) {
					entity?.destroy()
					entities.delete(entityKey)
				}
			}
		})
	})

	// Clear all entities on unmount
	$effect(() => {
		return () => {
			for (const [, entity] of entities) {
				entity?.destroy()
			}

			entities.clear()
		}
	})

	setContext<FramesContext>(key, {
		get current() {
			return current
		},
	})
}

export const useFrames = (): FramesContext => {
	return getContext<FramesContext>(key)
}

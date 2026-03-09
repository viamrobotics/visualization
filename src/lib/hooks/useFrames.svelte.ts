import { getContext, setContext, untrack } from 'svelte'
import { MachineConnectionEvent, Transform } from '@viamrobotics/sdk'
import {
	useRobotClient,
	createRobotQuery,
	useMachineStatus,
	useConnectionStatus,
} from '@viamrobotics/svelte-sdk'
import { type ConfigurableTrait, type Entity } from 'koota'
import { useLogs } from './useLogs.svelte'
import { resourceNameToColor } from '$lib/color'
import { useEnvironment } from './useEnvironment.svelte'
import { createPose } from '$lib/transform'
import { useResourceByName } from './useResourceByName.svelte'
import { traits, useWorld } from '$lib/ecs'
import { useConfigFrames } from './useConfigFrames.svelte'

interface FramesContext {
	current: Transform[]
}

const key = Symbol('frames-context')

export const provideFrames = (partID: () => string) => {
	const configFrames = useConfigFrames()
	const environment = useEnvironment()
	const world = useWorld()
	const resourceByName = useResourceByName()
	const client = useRobotClient(partID)
	const connectionStatus = useConnectionStatus(partID)
	const machineStatus = useMachineStatus(partID)
	const logs = useLogs()

	const isEditMode = $derived(environment.current.viewerMode === 'edit')
	const query = createRobotQuery(client, 'frameSystemConfig', () => ({
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

		for (const { frame } of query.data ?? []) {
			if (frame === undefined) {
				continue
			}

			frames[frame.referenceFrame] = frame
		}

		if (isEditMode || connectionStatus.current === MachineConnectionEvent.DISCONNECTED) {
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
		 * If we're not in edit mode and we have a robot connection,
		 * we only use frames reported by the machine
		 *
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

	$effect.pre(() => {
		if (current.length === 0) return

		const currentResourcesByName = resourceByName.current

		// We only want to update whenever "current" or "resourceByName.current" changes
		untrack(() => {
			const active: Record<string, boolean> = {}

			for (const frame of current) {
				const name = frame.referenceFrame
				active[name] = true

				const parent = frame.poseInObserverFrame?.referenceFrame
				const pose = createPose(frame.poseInObserverFrame?.pose)
				const center = frame.physicalObject?.center
					? createPose(frame.physicalObject.center)
					: undefined
				const resourceName = currentResourcesByName[frame.referenceFrame]
				const color = resourceNameToColor(resourceName)

				const existing = entities.get(name)

				if (existing) {
					if (!parent || parent === 'world') {
						existing.remove(traits.Parent)
					} else if (parent && existing.has(traits.Parent)) {
						existing.set(traits.Parent, parent)
					} else {
						existing.add(traits.Parent(parent))
					}

					if (color) {
						existing.set(traits.Color, color)
					}

					if (center) {
						existing.set(traits.Center, center)
					}

					existing.remove(traits.Box, traits.Sphere, traits.BufferGeometry, traits.Capsule)
					if (frame.physicalObject) {
						const geometry = traits.Geometry(frame.physicalObject)
						existing.add(geometry)
					}

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

				entities.set(name, entity)
			}

			// Clean up non-active entities
			for (const [name, entity] of entities) {
				if (!active[name]) {
					entity?.destroy()
					entities.delete(name)
					continue
				}
			}
		})
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

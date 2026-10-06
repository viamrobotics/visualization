import { MachineConnectionEvent, type robotApi } from '@viamrobotics/sdk'
import { createRobotQuery, useConnectionStatus, useRobotClient } from '@viamrobotics/svelte-sdk'
import { type ConfigurableTrait, type Entity } from 'koota'
import { getContext, setContext, untrack } from 'svelte'

import type { Transform } from '$lib/geometry'
import type { RawKinematicsModel } from '$lib/kinematicsTransform'

import { resourceNameToColor, subtypeToColor } from '$lib/color'
import { configColorsByFrame } from '$lib/configColors'
import { hierarchy, setOrAddTrait, traits, TRANSLUCENT_GEOMETRY_OPACITY, useWorld } from '$lib/ecs'
import { deriveKinematicsFrames, ownerOfInternalFrame } from '$lib/kinematicsFrames'
import { Pose } from '$lib/math'
import { obstacleShapeEntries } from '$lib/obstacleShapeEntries'
import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

import { machineFrameNames } from './machineFrameNames'
import { mergeObstacleFrames } from './mergeObstacleFrames'
import { useConfigFrames } from './useConfigFrames.svelte'
import { useEnvironment } from './useEnvironment.svelte'
import { usePartConfig } from './usePartConfig.svelte'
import { useResourceByName } from './useResourceByName.svelte'

export interface FramesContext {
	current: Transform[]
	/**
	 * The raw `frameSystemConfig` reply, the only place `kinematics` survives. A disabled query keeps
	 * its data, so non-empty does not mean live: `current` may have fallen back to config frames.
	 */
	parts: robotApi.FrameSystemConfig[]
	/** How many frames the machine reported, or `undefined` before it has answered. */
	readonly machineFrameCount: number | undefined
	/** True while the first `frameSystemConfig` request is in flight. */
	readonly isLoadingMachineFrames: boolean
	/** Components whose frame is a model's mount — the set `usePoses` redirects. */
	readonly kinematicsComponents: ReadonlySet<string>
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
	const logs = useLogs()

	// In build mode the user authors the scene from the part config, so config
	// frames win the merge below.
	const isBuildMode = $derived(environment.current.mode === 'build')

	const isConnected = $derived(connectionStatus.current === MachineConnectionEvent.CONNECTED)

	// The same condition under which `frames` below lets config win the merge.
	const isConfigAuthoritative = $derived(isBuildMode || !isConnected)

	const query = createRobotQuery(client, 'frameSystemConfig', () => ({
		refetchOnWindowFocus: false,
		// The call needs a live robot client. Naming a part is not enough, and firing
		// on the name alone answers `not connected yet` for every machine on load.
		enabled: partID() !== '' && isConnected,
	}))

	$effect(() => {
		if (query.isFetching) {
			logs.add('Fetching frames...', 'info', { folder: 'frames' })
		} else if (query.error) {
			logs.add(`Frames: ${query.error.message}`, 'error', { folder: 'frames' })
		}
	})

	const kinematicsByComponent = $derived.by(() => {
		const result: Record<string, RawKinematicsModel> = {}
		for (const fsConfig of query.data ?? []) {
			const componentName = fsConfig.frame?.referenceFrame
			if (
				componentName === undefined ||
				componentName === '' ||
				fsConfig.kinematics === undefined ||
				Object.keys(fsConfig.kinematics.fields).length === 0
			) {
				continue
			}
			result[componentName] = fsConfig.kinematics.toJson() as RawKinematicsModel
		}
		return result
	})

	const kinematicsDerivedFrames = $derived.by(() => {
		const frames: Record<string, Transform> = {}

		for (const [componentName, model] of Object.entries(kinematicsByComponent)) {
			for (const frame of deriveKinematicsFrames(componentName, model)) {
				frames[frame.referenceFrame] = frame
			}
		}

		return frames
	})

	/**
	 * The component a derived frame belongs to — `arm-1` for `arm-1:upper_arm`.
	 * Gated on the prefix being a real kinematics component.
	 */
	const ownerComponent = $derived((frameName: string) => {
		const namespaced = ownerOfInternalFrame(frameName)
		if (namespaced === undefined) {
			return frameName
		}
		const isKinematicsOwner = namespaced in kinematicsByComponent
		const isConfigObstacleOwner = isConfigAuthoritative && namespaced in configFrames.obstacleFrames
		return isKinematicsOwner || isConfigObstacleOwner ? namespaced : frameName
	})

	const frames = $derived.by(() => {
		const frames: Record<string, Transform> = {}

		for (const { frame } of query.data ?? []) {
			if (frame === undefined) {
				continue
			}

			frames[frame.referenceFrame] = frame
		}

		// Let config frames take priority in build mode (the user is authoring
		// the scene) or when we don't have a live robot connection. The latter
		// covers DISCONNECTED, CONNECTING, and the undefined case where the
		// embedder never provided a dial config (e.g. the Viam app's
		// dialConfigsForParts filters to live parts only, so offline parts
		// never transition through DISCONNECTED).
		if (isConfigAuthoritative) {
			const mergedFrames = { ...frames }

			// Never overwrite a frame the machine already reported. This fragment
			// frame was resolved here rather than by the server, so where the two
			// disagree the machine is the one that ran the config.
			for (const [name, frame] of Object.entries(configFrames.fragmentFrames)) {
				mergedFrames[name] ??= frame
			}

			for (const [name, frame] of Object.entries(configFrames.current)) {
				mergedFrames[name] = frame
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

	// Config obstacles replace the links the machine reports for them only while config is authoritative.
	const sceneDerivedFrames = $derived(
		isConfigAuthoritative
			? mergeObstacleFrames(kinematicsDerivedFrames, configFrames.obstacleFrames)
			: kinematicsDerivedFrames
	)

	const configObstacleFrameNames = $derived(
		isConfigAuthoritative
			? new Set(
					Object.values(configFrames.obstacleFrames).flatMap((obstacleFrames) =>
						obstacleFrames.map((obstacleFrame) => obstacleFrame.referenceFrame)
					)
				)
			: new Set<string>()
	)

	const current = $derived([...Object.values(frames), ...Object.values(sceneDerivedFrames)])

	const askableFrameNames = $derived(
		machineFrameNames(query.data, Object.keys(kinematicsDerivedFrames))
	)

	const entities = new Map<string, Entity | undefined>()

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

	const shapeEntries = $derived(obstacleShapeEntries(partConfig.current.components))
	const configColors = $derived(configColorsByFrame(partConfig.current.components))

	$effect(() => {
		const currentResourcesByName = resourceByName.current
		const currentPartID = partID()
		const currentComponentSubtypeByName = componentSubtypeByName
		const currentShapeEntries = shapeEntries
		const currentConfigColors = configColors
		const currentFrames = current
		const currentDerivedFrames = sceneDerivedFrames
		const currentConfigObstacleFrameNames = configObstacleFrameNames
		const currentAskableFrameNames = askableFrameNames

		// We only want to update whenever "current" or "resourceByName.current" changes
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		currentFrames.length

		untrack(() => {
			const active: Record<string, boolean> = {}

			for (const frame of currentFrames) {
				const name = frame.referenceFrame
				const entityKey = `${currentPartID}:${name}`
				active[entityKey] = true

				const parent = frame.poseInObserverFrame?.referenceFrame
				const pose = new Pose().copy(frame.poseInObserverFrame?.pose)

				const center = frame.physicalObject?.center
					? new Pose().copy(frame.physicalObject.center)
					: undefined
				// Colors resolve against the owning component so an arm's links keep the
				// arm's color; a link's own name matches no resource. A color saved in the config wins,
				// the frame's own over its resource's.
				const owner = ownerComponent(name)
				const resourceName = currentResourcesByName[owner]
				const color =
					currentConfigColors.get(name) ??
					currentConfigColors.get(owner) ??
					resourceNameToColor(resourceName) ??
					subtypeToColor(currentComponentSubtypeByName[owner])

				// A config obstacle is config-only even when the machine knows the name, or pose polling
				// would overwrite the draft pose with the saved one.
				const isConfigObstacle = currentConfigObstacleFrameNames.has(name)
				const isConfigOnly = isConfigObstacle || !currentAskableFrameNames.has(name)
				const shapeEntry = currentShapeEntries.get(name)
				const isObstacleShape = shapeEntry !== undefined && !shapeEntry.isComplex
				const complexShapeIndex = shapeEntry?.isComplex ? shapeEntry.index : undefined

				const existing = entities.get(entityKey)

				if (existing) {
					// Sync the data-derived traits from config/live. EditedMatrix is
					// intentionally left untouched: it belongs to the editing layer
					// (FrameEditor), which creates it on edit and clears it on discard.
					// useFrames never reads or writes it, so this re-sync can't fight an
					// in-progress edit.
					hierarchy.setParent(existing, parent)

					// Saving the config hands the frame to the machine, which is what
					// makes its pose askable, so the marker has to come off again.
					if (isConfigOnly !== existing.has(traits.ConfigOnlyFrame)) {
						if (isConfigOnly) {
							existing.add(traits.ConfigOnlyFrame)
						} else {
							existing.remove(traits.ConfigOnlyFrame)
						}
					}

					if (isObstacleShape !== existing.has(traits.ObstacleShape)) {
						if (isObstacleShape) {
							existing.add(traits.ObstacleShape)
						} else {
							existing.remove(traits.ObstacleShape)
						}
					}

					if (complexShapeIndex === undefined) {
						if (existing.has(traits.ComplexObstacleShape))
							existing.remove(traits.ComplexObstacleShape)
					} else if (existing.get(traits.ComplexObstacleShape)?.index !== complexShapeIndex) {
						setOrAddTrait(existing, traits.ComplexObstacleShape, { index: complexShapeIndex })
					}

					if (color) {
						const cur = existing.get(traits.Color)
						if (!cur || cur.r !== color.r || cur.g !== color.g || cur.b !== color.b) {
							setOrAddTrait(existing, traits.Color, color)
						}
					}

					if (center && !center.equals(existing.get(traits.Center))) {
						setOrAddTrait(existing, traits.Center, center)
					}

					traits.updateGeometryTrait(existing, frame.physicalObject)

					// The baseline is the reference the WorldMatrix blend
					// (live × baseline⁻¹ × edited) composes the staged edit against.
					// Re-derive it from incoming config only while monitoring and clean:
					// freezing it in build mode (or with unsaved edits) keeps the blend
					// previewing the edit instead of collapsing to a stale LiveMatrix.
					if (!partConfig.isDirty && !isBuildMode) {
						const baseline = existing.get(traits.Matrix)
						if (baseline) {
							pose.toMatrix4(baseline)
							existing.changed(traits.Matrix)
						}
					}

					// A config obstacle has no live source, so a pose edit reaches the entity only through
					// this write. Elsewhere Matrix is frozen in build mode and LiveMatrix is only set at spawn.
					if (isConfigObstacle) {
						for (const trait of [traits.Matrix, traits.LiveMatrix]) {
							const matrix = existing.get(trait)
							if (matrix) {
								const next = pose.toMatrix4()
								if (!matrix.equals(next)) {
									matrix.copy(next)
									existing.changed(trait)
								}
							}
						}
					}

					if (!existing.has(traits.LiveMatrix)) {
						existing.add(traits.LiveMatrix(pose.toMatrix4()))
					}

					continue
				}

				const entityTraits: ConfigurableTrait[] = [
					traits.Name(name),
					traits.Matrix(pose.toMatrix4()),
					traits.LiveMatrix(pose.toMatrix4()),
					traits.FramesAPI,
					traits.ShowAxesHelper,
					...hierarchy.parentTraits(parent),
				]

				if (isConfigOnly) {
					entityTraits.push(traits.ConfigOnlyFrame)
				}

				if (isObstacleShape) {
					entityTraits.push(traits.ObstacleShape)
				}

				if (complexShapeIndex !== undefined) {
					entityTraits.push(traits.ComplexObstacleShape({ index: complexShapeIndex }))
				}

				if (name in currentDerivedFrames) {
					entityTraits.push(traits.KinematicLink)
				} else {
					// Derived links are synthesized from the model; there is no
					// `components.<arm>:<link>` for an edit to write to.
					entityTraits.push(traits.Editable)
				}

				if (color) {
					entityTraits.push(traits.Color(color))
				}

				if (center) {
					entityTraits.push(traits.Center(center))
				}

				if (frame.physicalObject) {
					entityTraits.push(
						traits.Geometry(frame.physicalObject),
						traits.Opacity(TRANSLUCENT_GEOMETRY_OPACITY)
					)
				}

				const entity = world.spawn(...entityTraits)

				entities.set(entityKey, entity)
			}

			for (const [entityKey, entity] of entities) {
				if (!active[entityKey]) {
					entity?.destroy()
					entities.delete(entityKey)
				}
			}
		})
	})

	$effect(() => {
		return () => {
			for (const [, entity] of entities) {
				entity?.destroy()
			}

			entities.clear()
		}
	})

	const parts = $derived(query.data ?? [])
	const kinematicsComponents = $derived(new Set(Object.keys(kinematicsByComponent)))

	setContext<FramesContext>(key, {
		get current() {
			return current
		},
		get parts() {
			return parts
		},
		get machineFrameCount() {
			return query.data?.length
		},
		get isLoadingMachineFrames() {
			return query.isLoading
		},
		get kinematicsComponents() {
			return kinematicsComponents
		},
	})
}

export const useFrames = (): FramesContext => {
	return getContext<FramesContext>(key)
}

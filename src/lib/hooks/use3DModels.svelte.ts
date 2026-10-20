import type { Entity } from 'koota'
import type { Group, Object3D } from 'three'

import { isInstanceOf } from '@threlte/core'
import { type ArmClient, MachineConnectionEvent } from '@viamrobotics/sdk'
import { useConnectionStatus, useResourceStatuses } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { traits, useWorld } from '$lib/ecs'

import { useSettings } from './useSettings.svelte'

const gltfLoader = new GLTFLoader()
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
gltfLoader.setDRACOLoader(dracoLoader)

const key = Symbol('3d-models-context')

type Models = Record<string, Record<string, Group>>

/** The GLB buffers `get3DModels` returns, keyed by kinematics link id. */
type ArmMeshes = Awaited<ReturnType<ArmClient['get3DModels']>>

interface Context {
	current: Models
	readonly arms: string[]
	/** Whether an arm's models are worth fetching at all. */
	readonly shouldRender: boolean
	/** Hands one arm's fetched meshes to the shared parse queue. */
	parseArm: (armName: string, meshes: ArmMeshes) => void
}

/**
 * Resolves the loaded 3D model for a geometry entity's `Name`, formatted
 * `"<componentName>:<id>"`. Returns undefined when the name is malformed or no
 * model has been fetched for it. Shared by `GeometryModel` (to render the
 * model) and the `ColliderHidden` sync below (to hide the collider it replaces)
 * so the two decisions can never drift apart.
 */
export const matchModel = (name: string | undefined, models: Models): Group | undefined => {
	if (!name) return undefined
	const [componentName, id] = name.split(':')
	if (!componentName || !id) return undefined
	return models[componentName]?.[id]
}

const applyModelAppearance = (object: Object3D) => {
	if (!isInstanceOf(object, 'Mesh')) return

	// Set on the loaded model rather than each clone: `GeometryModel` clones per
	// frame, and `clone()` carries these flags across.
	object.castShadow = true
	object.receiveShadow = true

	const { material } = object

	if (isInstanceOf(material, 'MeshStandardMaterial')) {
		material.roughness = 0.3
		material.metalness = 0.1
	}
}

const syncColliderHidden = (entity: Entity, models: Models, hideColliders: boolean) => {
	const shouldHide = hideColliders && matchModel(entity.get(traits.Name), models) !== undefined
	if (shouldHide === entity.has(traits.ColliderHidden)) return
	if (shouldHide) {
		entity.add(traits.ColliderHidden)
	} else {
		entity.remove(traits.ColliderHidden)
	}
}

export const provide3DModels = (partID: () => string) => {
	const settings = useSettings()
	const world = useWorld()
	const connectionStatus = useConnectionStatus(partID)

	const isConnected = $derived(connectionStatus.current === MachineConnectionEvent.CONNECTED)
	const shouldRenderModels = $derived(
		settings.isLoaded && settings.current.renderArmModels.includes('model')
	)

	const armStatuses = useResourceStatuses(partID, 'arm')

	const arms = $derived(
		armStatuses.current
			.map((status) => status.name?.name)
			.filter((name): name is string => name !== undefined)
	)

	/**
	 * Parsed models are owned here rather than derived from the queries. A
	 * disconnect re-keys every resource query onto an empty one, and mirroring
	 * that into the scene is what dropped the arms back to their primitive
	 * colliders. An entry leaves only when its arm leaves the machine's config.
	 */
	const parsedModels: Models = {}
	// The buffer each parsed model came from, keyed `<arm>:<id>`. A reconnect
	// replays the same cached buffers, and re-parsing them would rebuild every
	// model's GPU resources for nothing.
	const parsedSources = new Map<string, Uint8Array>()

	let current = $state.raw<Models>({})

	const publish = () => {
		current = { ...parsedModels }
	}

	const forgetArm = (armName: string) => {
		delete parsedModels[armName]

		for (const cacheKey of parsedSources.keys()) {
			if (cacheKey.startsWith(`${armName}:`)) {
				parsedSources.delete(cacheKey)
			}
		}
	}

	/** @returns Whether anything new was parsed. */
	const parseArmMeshes = async (armName: string, meshes: ArmMeshes) => {
		let didParse = false

		for (const [id, mesh] of Object.entries(meshes)) {
			const source = mesh.mesh
			const cacheKey = `${armName}:${id}`

			if (parsedSources.get(cacheKey) === source) continue

			try {
				const buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
				const gltf = await gltfLoader.parseAsync(buffer as ArrayBuffer, '')
				gltf.scene.traverse(applyModelAppearance)

				parsedModels[armName] ??= {}
				parsedModels[armName][id] = gltf.scene
				parsedSources.set(cacheKey, source)
				didParse = true
			} catch (error) {
				console.warn(`[3d-models] ${cacheKey} failed to parse:`, error)
			}
		}

		return didParse
	}

	// Sequential: parsing a GLB is CPU-bound, and racing every arm at once stalls
	// the frame loop. Each arm queues onto the chain rather than parsing directly.
	let parseQueue = Promise.resolve()

	const parseArm = (armName: string, meshes: ArmMeshes) => {
		parseQueue = parseQueue.then(async () => {
			if (await parseArmMeshes(armName, meshes)) {
				publish()
			}
		})
	}

	// Declared before the effects that fill the cache so a part switch clears it
	// first: sibling effects re-run in creation order.
	$effect(() => {
		partID()

		return () => {
			for (const armName of Object.keys(parsedModels)) {
				forgetArm(armName)
			}
			current = {}
		}
	})

	/**
	 * Drops an arm's models once it leaves the machine's config. Gated on a live
	 * connection, because a disconnect empties the resource list too, and reading
	 * that as "the arm is gone" is the wipe this hook exists to avoid.
	 */
	$effect(() => {
		if (!isConnected) return

		const configured = new Set(arms)
		const stale = Object.keys(parsedModels).filter((armName) => !configured.has(armName))

		if (stale.length === 0) return

		for (const armName of stale) {
			forgetArm(armName)
		}

		publish()
	})

	/**
	 * Colliders are hidden only in the `'model'`-only mode — `'colliders+model'`
	 * intentionally shows both. Reacts to `current` (models finishing loading)
	 * and the setting; the `onAdd` listener covers frames that stream in while
	 * neither has changed.
	 *
	 * A collider named `<component>:<id>` is a kinematics link frame — the
	 * geometry that used to arrive from `getGeometries` now comes from the frame
	 * system, so `FramesAPI` is the only owner left.
	 */
	$effect(() => {
		const models = current
		const hideColliders = settings.current.renderArmModels === 'model'

		for (const entity of world.query(traits.FramesAPI)) {
			syncColliderHidden(entity, models, hideColliders)
		}

		return world.onAdd(traits.FramesAPI, (entity) => {
			syncColliderHidden(entity, models, hideColliders)
		})
	})

	/**
	 * A model whose key matches no frame renders nothing, and silently: it is the
	 * same outcome as an arm that ships no models at all. The two are worth
	 * telling apart, because a mismatch means the model keys and the kinematics
	 * link ids have drifted — `get3DModels` keys by bare link id, and frames are
	 * named `<component>:<id>` from the same ids.
	 */
	$effect(() => {
		const loaded = Object.entries(current).flatMap(([component, parts]) =>
			Object.keys(parts).map((id) => `${component}:${id}`)
		)
		if (loaded.length === 0) return

		const frameNames = new Set(
			world
				.query(traits.FramesAPI)
				.map((entity) => entity.get(traits.Name))
				.filter((name): name is string => name !== undefined)
		)
		const unmatched = loaded.filter((name) => !frameNames.has(name))
		if (unmatched.length === 0) return

		console.warn(
			`[3d-models] ${unmatched.length} of ${loaded.length} models match no frame: ${unmatched.join(', ')}`
		)
	})

	setContext<Context>(key, {
		get current() {
			return current
		},
		get arms() {
			return arms
		},
		get shouldRender() {
			return shouldRenderModels
		},
		parseArm,
	})
}

export const use3DModels = () => {
	return getContext<Context>(key)
}

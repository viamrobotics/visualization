import type { Entity, World } from 'koota'
import type { Group, Object3D } from 'three'

import type { RawKinematicsModel } from '#lib/kinematicsTransform.js'

import { traits } from '#lib/ecs/index.js'
import { matchModel, modelKey } from '#lib/hooks/use3DModels.svelte.js'

import type { SimExportNote } from './sim-scene'

import { buildSimScene, skipReason } from './build-sim-scene'
import { countExportNotes } from './export-notes-text'
import { loadGltfScene } from './load-gltf-scene'
import { packageSimExport } from './package-sim-export'
import { serializeMjcf } from './serialize-mjcf'
import { serializeUrdf } from './serialize-urdf'

export interface SimExportInput {
	world: World
	kinematics: Record<string, RawKinematicsModel>
	/** Loaded arm models by component, then link id, as `use3DModels` holds them. */
	armModels: Record<string, Record<string, Group>>
}

export interface SimExportResult {
	zip: Blob
	bodyCount: number
	noteCount: number
}

/**
 * Loads every draw-API GLTF the export keeps. One that fails is noted and left out rather than
 * failing the export.
 */
const loadDrawnModels = async (
	world: World,
	notes: SimExportNote[]
): Promise<Map<Entity, Object3D>> => {
	const entities = world.query(traits.GLTF).filter((entity) => skipReason(entity) === undefined)
	const loaded = await Promise.allSettled(
		entities.map(async (entity) => {
			const gltf = entity.get(traits.GLTF)
			if (!gltf) throw new Error('GLTF trait removed during export')
			return [entity, await loadGltfScene(gltf.source)] as const
		})
	)

	const models = new Map<Entity, Object3D>()
	for (const [index, result] of loaded.entries()) {
		if (result.status === 'fulfilled') {
			models.set(...result.value)
		} else {
			notes.push({ reason: 'model-load-failed', subject: entities[index]?.get(traits.Name) ?? '' })
		}
	}
	return models
}

/** Snapshots the scene and packages it as URDF and MJCF in one zip. */
export const exportSimScene = async ({
	world,
	kinematics,
	armModels,
}: SimExportInput): Promise<SimExportResult> => {
	const loadNotes: SimExportNote[] = []
	const drawnModels = await loadDrawnModels(world, loadNotes)

	const scene = buildSimScene({
		world,
		kinematics,
		visualModelFor: (entity) => drawnModels.get(entity) ?? matchModel(modelKey(entity), armModels),
	})
	const urdf = serializeUrdf(scene)
	const mjcf = serializeMjcf(scene)
	const sceneNotes = [...loadNotes, ...scene.notes]

	return {
		zip: await packageSimExport({ urdf, mjcf, sceneNotes }),
		bodyCount: scene.bodies.length,
		noteCount: countExportNotes([...sceneNotes, ...urdf.notes, ...mjcf.notes]),
	}
}

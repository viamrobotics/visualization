import type { Entity, World } from 'koota'
import type { Matrix4, Object3D } from 'three'

import type { RawKinematicsModel } from '$lib/kinematicsTransform'

import { hierarchy, traits } from '$lib/ecs'

import type { SimBody, SimExportNote, SimExportNoteReason, SimScene } from './sim-scene'

import { articulateComponent } from './articulate-component'
import { childrenByParent } from './children-by-parent'
import { entityGeoms } from './entity-geoms'

export interface BuildSimSceneInput {
	world: World
	/** Kinematics models by component name, from the `frameSystemConfig` reply. */
	kinematics: Record<string, RawKinematicsModel>
	/** The 3D model the scene draws in place of an entity's collider, if any. */
	visualModelFor: (entity: Entity) => Object3D | undefined
}

/** Why an entity has no body in the sim, or `undefined` when it gets one. */
const skipReason = (entity: Entity): SimExportNoteReason | undefined => {
	if (entity.has(traits.GhostModelKey)) return 'ghost-skipped'
	if (entity.has(traits.InheritedInvisible)) return 'hidden-skipped'
	if (entity.has(traits.Points)) return 'point-cloud-skipped'
	if (entity.has(traits.LinePositions) || entity.has(traits.Arrows) || entity.has(traits.Arrow)) {
		return 'drawing-skipped'
	}
	return undefined
}

/** The closest ancestor that also became a body, so a skipped parent does not orphan its children. */
const nearestIncludedAncestor = (
	entity: Entity,
	included: Map<Entity, string>
): Entity | undefined => {
	const seen = new Set<Entity>()
	let parent = hierarchy.getParentEntity(entity)
	while (parent && !included.has(parent) && !seen.has(parent)) {
		seen.add(parent)
		parent = hierarchy.getParentEntity(parent)
	}
	return parent && included.has(parent) ? parent : undefined
}

/** URDF's root link and MuJoCo's world body both go by this name, so no scene body may take it. */
const WORLD_BODY_NAME = 'world'

const uniqueNamer = () => {
	const taken = new Set<string>([WORLD_BODY_NAME])
	return (wanted: string): string => {
		let name = wanted
		for (let suffix = 2; taken.has(name); suffix++) name = `${wanted}_${suffix}`
		taken.add(name)
		return name
	}
}

/** `bodies` reordered so every parent precedes its children. Bodies in a parent cycle are dropped. */
const parentsFirst = (bodies: SimBody[]): SimBody[] => {
	const childrenOf = childrenByParent(bodies)
	const ordered: SimBody[] = []
	const visit = (parent: string | undefined) => {
		for (const child of childrenOf.get(parent) ?? []) {
			ordered.push(child)
			visit(child.name)
		}
	}
	visit(undefined)
	return ordered
}

/**
 * Snapshots the scene into sim-neutral bodies. Every visible entity with a world transform becomes a
 * welded body. Point clouds, drawings, ghosts, and hidden entities are left out and noted.
 * Components with a kinematics model become articulated chains posed as the scene shows them.
 */
export const buildSimScene = ({
	world,
	kinematics,
	visualModelFor,
}: BuildSimSceneInput): SimScene => {
	const notes: SimExportNote[] = []
	const nameFor = uniqueNamer()
	const included = new Map<Entity, string>()

	for (const entity of world.query(traits.WorldMatrix)) {
		const name = entity.get(traits.Name) || `entity_${entity.id()}`
		const reason = skipReason(entity)
		if (reason) {
			notes.push({ reason, subject: name })
			continue
		}
		included.set(entity, nameFor(name))
	}

	const bodiesByName = new Map<string, SimBody>()
	const configPoses = new Map<string, Matrix4>()
	for (const [entity, name] of included) {
		const parent = nearestIncludedAncestor(entity, included)
		const worldMatrix = entity.get(traits.WorldMatrix)
		if (!worldMatrix) continue

		// Relative to the entity's own parent, so it only stands in for the body's origin when that
		// parent is the body's parent too.
		const configPose = entity.get(traits.EditedMatrix) ?? entity.get(traits.Matrix)
		if (configPose && hierarchy.getParentEntity(entity) === parent) {
			configPoses.set(name, configPose.clone())
		}

		const origin = worldMatrix.clone()
		const parentWorld = parent?.get(traits.WorldMatrix)
		if (parentWorld) origin.premultiply(parentWorld.clone().invert())

		bodiesByName.set(name, {
			name,
			parent: parent ? included.get(parent) : undefined,
			origin,
			joint: undefined,
			geoms: entityGeoms(entity, visualModelFor(entity), notes),
		})
	}

	const jointBodies = Object.entries(kinematics).flatMap(([componentName, model]) =>
		articulateComponent(componentName, model, {
			bodiesByName,
			nameFor,
			configPoseOf: (bodyName) => configPoses.get(bodyName),
			notes,
		})
	)

	return { bodies: parentsFirst([...bodiesByName.values(), ...jointBodies]), notes }
}

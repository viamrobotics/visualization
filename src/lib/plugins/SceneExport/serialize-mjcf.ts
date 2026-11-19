import { type Matrix4, Quaternion, Vector3 } from 'three'

import type { SimBody, SimDocument, SimExportNote, SimGeom, SimScene } from './sim-scene'

import { PLACEHOLDER_INERTIA_KG_M2, PLACEHOLDER_MASS_KG } from './estimate-inertial'
import { indentXml } from './indent-xml'
import { meshFileNamer } from './mesh-file-namer'
import { xmlNumbers, xmlText } from './xml-attribute-values'

const MODEL_NAME = 'viam_scene'
const SNAPSHOT_KEY = 'snapshot'

/**
 * Geom groups the MuJoCo viewer toggles. 0 to 2 are drawn by default, so visual-only geoms sit in 1
 * and collision-only geoms in 3, hidden until asked for.
 */
const VISUAL_GROUP = 1
const COLLISION_GROUP = 3

const JOINT_TYPES = { revolute: 'hinge', prismatic: 'slide' } as const

const position = new Vector3()
const rotation = new Quaternion()
const scale = new Vector3()

/** MuJoCo's `quat` is `w x y z`, scalar first, unlike three's. */
const poseAttributes = (origin: Matrix4): string => {
	origin.decompose(position, rotation, scale)
	return `pos="${xmlNumbers(position.x, position.y, position.z)}" quat="${xmlNumbers(rotation.w, rotation.x, rotation.y, rotation.z)}"`
}

/** MuJoCo sizes primitives by half extents, and a capsule by its straight section alone. */
const shapeAttributes = (geom: SimGeom, meshName: string | undefined): string => {
	const { shape } = geom
	switch (shape.kind) {
		case 'box': {
			const half = shape.size.clone().multiplyScalar(0.5)
			return `type="box" size="${xmlNumbers(half.x, half.y, half.z)}"`
		}
		case 'sphere': {
			return `type="sphere" size="${xmlNumbers(shape.radius)}"`
		}
		case 'cylinder': {
			return `type="cylinder" size="${xmlNumbers(shape.radius, shape.length / 2)}"`
		}
		case 'capsule': {
			const halfStraight = (shape.length - 2 * shape.radius) / 2
			if (halfStraight <= 0) return `type="sphere" size="${xmlNumbers(shape.radius)}"`
			return `type="capsule" size="${xmlNumbers(shape.radius, halfStraight)}"`
		}
		case 'mesh': {
			return `type="mesh" mesh="${xmlText(meshName ?? '')}"`
		}
		default: {
			const unreachable: never = shape
			return unreachable
		}
	}
}

/** Visual-only geoms neither collide nor weigh anything, so only collision geoms set a body's mass. */
const ROLE_ATTRIBUTES: Record<SimGeom['role'], string> = {
	visual: `contype="0" conaffinity="0" density="0" group="${VISUAL_GROUP}"`,
	collision: `group="${COLLISION_GROUP}"`,
	'visual-and-collision': '',
}

interface MjcfWriter {
	childrenOf: Map<string | undefined, SimBody[]>
	assets: string[]
	meshes: SimDocument['meshes']
	nameMeshFile: (bodyName: string) => string
	jointValues: number[]
	notes: SimExportNote[]
}

const geomElement = (writer: MjcfWriter, body: SimBody, geom: SimGeom): string => {
	let meshName: string | undefined
	if (geom.shape.kind === 'mesh') {
		const path = writer.nameMeshFile(body.name)
		meshName = `mesh_${writer.assets.length}`
		writer.assets.push(`<mesh name="${meshName}" file="${xmlText(path)}"/>`)
		writer.meshes.set(path, geom.shape.geometry)
		if (geom.role !== 'visual') {
			writer.notes.push({ reason: 'mujoco-hulls-collision-mesh', subject: body.name })
		}
	}
	const attributes = [
		shapeAttributes(geom, meshName),
		poseAttributes(geom.origin),
		`rgba="${xmlNumbers(...geom.rgba)}"`,
		ROLE_ATTRIBUTES[geom.role],
	].filter(Boolean)
	return `<geom ${attributes.join(' ')}/>`
}

/**
 * A `<body>` and everything below it. Joint values are collected in the order the joints are
 * written, which is the order MuJoCo lays out `qpos`.
 */
const bodyElement = (writer: MjcfWriter, body: SimBody): string => {
	const children: string[] = []

	if (body.geoms.every((geom) => geom.role === 'visual')) {
		const moment = PLACEHOLDER_INERTIA_KG_M2
		children.push(
			`<inertial pos="0 0 0" mass="${PLACEHOLDER_MASS_KG}" diaginertia="${xmlNumbers(moment, moment, moment)}"/>`
		)
	}

	if (body.joint) {
		const { axis, lower, type, upper, value } = body.joint
		children.push(
			`<joint name="${xmlText(body.name)}" type="${JOINT_TYPES[type]}" axis="${xmlNumbers(axis.x, axis.y, axis.z)}" range="${xmlNumbers(lower, upper)}"/>`
		)
		writer.jointValues.push(value)
	}

	for (const geom of body.geoms) children.push(geomElement(writer, body, geom))
	for (const child of writer.childrenOf.get(body.name) ?? []) {
		children.push(bodyElement(writer, child))
	}

	return [
		`<body name="${xmlText(body.name)}" ${poseAttributes(body.origin)}>`,
		indentXml(children.join('\n')),
		'</body>',
	].join('\n')
}

/**
 * The scene as one MuJoCo model. Bodies without a joint are welded, so obstacles under `worldbody`
 * stay put. A `snapshot` keyframe holds the joint positions the scene showed. MuJoCo derives mass
 * from geoms at its default density, and collides every mesh as its convex hull.
 */
export const serializeMjcf = (scene: SimScene): SimDocument => {
	const childrenOf = new Map<string | undefined, SimBody[]>()
	for (const body of scene.bodies) {
		childrenOf.set(body.parent, [...(childrenOf.get(body.parent) ?? []), body])
	}

	const writer: MjcfWriter = {
		childrenOf,
		assets: [],
		meshes: new Map(),
		nameMeshFile: meshFileNamer(),
		jointValues: [],
		notes: [],
	}

	const worldBodies = (childrenOf.get(undefined) ?? []).map((body) => bodyElement(writer, body))

	if (scene.bodies.some((body) => body.geoms.some((geom) => geom.role !== 'visual'))) {
		writer.notes.push({ reason: 'inertia-estimated', subject: 'MJCF' })
	}

	const sections = [
		'<compiler angle="radian" inertiafromgeom="auto" autolimits="true"/>',
		writer.assets.length > 0
			? ['<asset>', indentXml(writer.assets.join('\n')), '</asset>'].join('\n')
			: '',
		['<worldbody>', indentXml(worldBodies.join('\n')), '</worldbody>'].join('\n'),
		writer.jointValues.length > 0
			? `<keyframe><key name="${SNAPSHOT_KEY}" qpos="${xmlNumbers(...writer.jointValues)}"/></keyframe>`
			: '',
	].filter(Boolean)

	const document = [
		`<mujoco model="${MODEL_NAME}">`,
		indentXml(sections.join('\n')),
		'</mujoco>',
		'',
	].join('\n')

	return { document, meshes: writer.meshes, sidecars: new Map(), notes: writer.notes }
}

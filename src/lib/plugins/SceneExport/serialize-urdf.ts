import { type BufferGeometry, Euler, type Matrix4, Quaternion, Vector3 } from 'three'

import type { SimBody, SimDocument, SimExportNote, SimGeom, SimJoint, SimScene } from './sim-scene'

import { capsuleMesh } from './capsule-mesh'
import { convexHull } from './convex-hull'
import { estimateInertial, type SimInertial } from './estimate-inertial'
import { indentXml } from './indent-xml'
import { meshFileNamer } from './mesh-file-namer'
import { movingBodies } from './moving-bodies'
import { xmlNumbers, xmlText } from './xml-attribute-values'

const ROBOT_NAME = 'viam_scene'
const ROOT_LINK = 'world'

/**
 * URDF requires an effort and a velocity limit on every moving joint, and Viam models carry no effort
 * and only sometimes a velocity. These are generous enough not to hold a sim's controller back.
 */
const PLACEHOLDER_EFFORT = 1000
const PLACEHOLDER_VELOCITY: Record<SimJoint['type'], number> = { revolute: Math.PI, prismatic: 1 }

const position = new Vector3()
const rotation = new Quaternion()
const scale = new Vector3()
const rollPitchYaw = new Euler()

/** URDF's `rpy` is fixed-axis X, then Y, then Z, which is three's intrinsic `ZYX`. */
const originElement = (origin: Matrix4): string => {
	origin.decompose(position, rotation, scale)
	rollPitchYaw.setFromQuaternion(rotation, 'ZYX')
	return `<origin xyz="${xmlNumbers(position.x, position.y, position.z)}" rpy="${xmlNumbers(rollPitchYaw.x, rollPitchYaw.y, rollPitchYaw.z)}"/>`
}

const inertialElement = ({ mass, centerOfMass, inertia }: SimInertial): string => {
	// Column-major, and symmetric, so the upper triangle reads the same either way.
	const elements = inertia.elements
	const [xx, xy, xz] = elements
	const [yy, yz] = elements.slice(4, 6)
	const zz = elements[8]
	return [
		'<inertial>',
		`\t<origin xyz="${xmlNumbers(centerOfMass.x, centerOfMass.y, centerOfMass.z)}" rpy="0 0 0"/>`,
		`\t<mass value="${xmlNumbers(mass)}"/>`,
		`\t<inertia ixx="${xmlNumbers(xx)}" ixy="${xmlNumbers(xy)}" ixz="${xmlNumbers(xz)}" iyy="${xmlNumbers(yy)}" iyz="${xmlNumbers(yz)}" izz="${xmlNumbers(zz)}"/>`,
		'</inertial>',
	].join('\n')
}

interface UrdfWriter {
	moving: Set<string>
	notes: SimExportNote[]
	meshes: Map<string, BufferGeometry>
	/** By the shape a file was written for, so a visual and a collision of one shape share it. */
	meshFiles: Map<object, string>
	nameMeshFile: (bodyName: string) => string
}

const meshFile = (
	writer: UrdfWriter,
	bodyName: string,
	shape: object,
	toGeometry: () => BufferGeometry
): string => {
	const existing = writer.meshFiles.get(shape)
	if (existing) return existing
	const path = writer.nameMeshFile(bodyName)
	writer.meshFiles.set(shape, path)
	writer.meshes.set(path, toGeometry())
	return path
}

/**
 * The `<geometry>` for one geom. URDF has no capsule, so a capsule becomes a mesh, or a sphere when
 * it has no straight section.
 */
const geometryElement = (writer: UrdfWriter, bodyName: string, geom: SimGeom): string => {
	const { shape } = geom
	switch (shape.kind) {
		case 'box': {
			return `<box size="${xmlNumbers(shape.size.x, shape.size.y, shape.size.z)}"/>`
		}
		case 'sphere': {
			return `<sphere radius="${xmlNumbers(shape.radius)}"/>`
		}
		case 'cylinder': {
			return `<cylinder radius="${xmlNumbers(shape.radius)}" length="${xmlNumbers(shape.length)}"/>`
		}
		case 'capsule': {
			if (shape.length <= 2 * shape.radius) return `<sphere radius="${xmlNumbers(shape.radius)}"/>`
			const path = meshFile(writer, bodyName, shape, () => capsuleMesh(shape.radius, shape.length))
			return `<mesh filename="${xmlText(path)}"/>`
		}
		case 'mesh': {
			const path = meshFile(writer, bodyName, shape, () => shape.geometry)
			return `<mesh filename="${xmlText(path)}"/>`
		}
		default: {
			const unreachable: never = shape
			return unreachable
		}
	}
}

const visualElement = (
	writer: UrdfWriter,
	body: SimBody,
	geom: SimGeom,
	materialName: string
): string =>
	[
		'<visual>',
		`\t${originElement(geom.origin)}`,
		`\t<geometry>${geometryElement(writer, body.name, geom)}</geometry>`,
		`\t<material name="${xmlText(materialName)}"><color rgba="${xmlNumbers(...geom.rgba)}"/></material>`,
		'</visual>',
	].join('\n')

/**
 * A `<collision>`. On a moving body a mesh collides as its convex hull, since physics engines handle
 * a concave mesh on a dynamic body badly or not at all.
 */
const collisionElement = (writer: UrdfWriter, body: SimBody, geom: SimGeom): string => {
	let collisionGeom = geom
	if (geom.shape.kind === 'mesh' && writer.moving.has(body.name)) {
		collisionGeom = { ...geom, shape: { kind: 'mesh', geometry: convexHull(geom.shape.geometry) } }
		writer.notes.push({ reason: 'collision-mesh-hulled', subject: body.name })
	}
	return [
		'<collision>',
		`\t${originElement(collisionGeom.origin)}`,
		`\t<geometry>${geometryElement(writer, body.name, collisionGeom)}</geometry>`,
		'</collision>',
	].join('\n')
}

const linkElement = (writer: UrdfWriter, body: SimBody): string => {
	const children = [inertialElement(estimateInertial(body.geoms))]
	for (const [index, geom] of body.geoms.entries()) {
		if (geom.role !== 'collision') {
			children.push(visualElement(writer, body, geom, `${body.name}_material_${index}`))
		}
		if (geom.role !== 'visual') children.push(collisionElement(writer, body, geom))
	}
	return [`<link name="${xmlText(body.name)}">`, indentXml(children.join('\n')), '</link>'].join(
		'\n'
	)
}

const jointName = (body: SimBody): string => `${body.name}_joint`

const jointElement = (body: SimBody): string => {
	const { joint } = body
	const lines = [
		`<parent link="${xmlText(body.parent ?? ROOT_LINK)}"/>`,
		`<child link="${xmlText(body.name)}"/>`,
		originElement(body.origin),
	]
	if (joint) {
		const velocity = joint.maxVelocity ?? PLACEHOLDER_VELOCITY[joint.type]
		lines.push(
			`<axis xyz="${xmlNumbers(joint.axis.x, joint.axis.y, joint.axis.z)}"/>`,
			`<limit lower="${xmlNumbers(joint.lower)}" upper="${xmlNumbers(joint.upper)}" effort="${PLACEHOLDER_EFFORT}" velocity="${xmlNumbers(velocity)}"/>`
		)
	}
	return [
		`<joint name="${xmlText(jointName(body))}" type="${joint?.type ?? 'fixed'}">`,
		indentXml(lines.join('\n')),
		'</joint>',
	].join('\n')
}

const INITIAL_POSITIONS_FILE = 'initial_positions.yaml'

/** A YAML double-quoted scalar. Joint names carry `:`, which YAML reads as a key separator. */
const yamlString = (text: string): string =>
	`"${text.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`)}"`

/**
 * The snapshot's joint positions, in the `initial_positions` shape MoveIt's setup assistant writes
 * and ros2_control launch files read. URDF itself has nowhere to put them.
 */
const initialPositionsYaml = (bodies: readonly SimBody[]): string | undefined => {
	const lines = bodies.flatMap((body) =>
		body.joint ? [`  ${yamlString(jointName(body))}: ${xmlNumbers(body.joint.value)}`] : []
	)
	if (lines.length === 0) return undefined
	return [
		'# Joint positions shown in the scene when it was exported. Radians for revolute joints, metres for prismatic.',
		'initial_positions:',
		...lines,
		'',
	].join('\n')
}

/**
 * The scene as one URDF robot rooted at a `world` link. Every body is a link on a fixed joint, or a
 * revolute or prismatic one where the scene has a joint. URDF has no initial joint state, so the
 * robot is written at the zero pose, and the snapshot's joint positions go in `initial_positions.yaml`.
 */
export const serializeUrdf = (scene: SimScene): SimDocument => {
	const writer: UrdfWriter = {
		moving: movingBodies(scene.bodies),
		notes: [],
		meshes: new Map(),
		meshFiles: new Map(),
		nameMeshFile: meshFileNamer(),
	}

	const elements = [`<link name="${ROOT_LINK}"/>`]
	for (const body of scene.bodies) {
		elements.push(linkElement(writer, body), jointElement(body))
	}

	if (scene.bodies.some((body) => body.geoms.some((geom) => geom.role !== 'visual'))) {
		writer.notes.push({ reason: 'inertia-estimated', subject: 'URDF' })
	}
	if (scene.bodies.some((body) => body.joint)) {
		writer.notes.push({ reason: 'joint-limits-placeholder', subject: 'URDF' })
	}

	const document = [
		'<?xml version="1.0"?>',
		`<robot name="${ROBOT_NAME}">`,
		indentXml(elements.join('\n')),
		'</robot>',
		'',
	].join('\n')

	const sidecars = new Map<string, string>()
	const initialPositions = initialPositionsYaml(scene.bodies)
	if (initialPositions) sidecars.set(INITIAL_POSITIONS_FILE, initialPositions)

	return { document, meshes: writer.meshes, sidecars, notes: writer.notes }
}

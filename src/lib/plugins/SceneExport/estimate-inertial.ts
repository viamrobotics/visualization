import { Box3, Matrix3, Vector3 } from 'three'

import type { SimGeom, SimShape } from './sim-scene'

/** Water. MuJoCo's default geom density, so URDF and MJCF exports weigh a body the same. */
const DENSITY_KG_PER_M3 = 1000

/**
 * Stand-ins for a body with no collision geometry. sdformat drops a URDF link with no inertia, and
 * MuJoCo refuses a moving body without one, so these keep the body without weighing anything.
 */
export const PLACEHOLDER_MASS_KG = 0.001
export const PLACEHOLDER_INERTIA_KG_M2 = 1e-6

export interface SimInertial {
	mass: number
	/** In the body's frame. */
	centerOfMass: Vector3
	/** About the center of mass, in the body's axes. */
	inertia: Matrix3
}

interface ShapeInertial {
	mass: number
	/** In the geom's frame. A mesh's bounding box need not be centered on its origin. */
	center: Vector3
	/** Principal moments about `center`, in the geom's axes. */
	moments: Vector3
}

const boxInertial = (size: Vector3, center: Vector3): ShapeInertial => {
	const mass = DENSITY_KG_PER_M3 * size.x * size.y * size.z
	const [x2, y2, z2] = [size.x ** 2, size.y ** 2, size.z ** 2]
	return {
		mass,
		center,
		moments: new Vector3(y2 + z2, x2 + z2, x2 + y2).multiplyScalar(mass / 12),
	}
}

const capsuleInertial = (radius: number, length: number): ShapeInertial => {
	const height = Math.max(length - 2 * radius, 0)
	const r2 = radius ** 2
	const cylinderMass = DENSITY_KG_PER_M3 * Math.PI * r2 * height
	const capsMass = DENSITY_KG_PER_M3 * (4 / 3) * Math.PI * radius ** 3
	const axial = cylinderMass * (r2 / 2) + capsMass * ((2 * r2) / 5)
	const transverse =
		cylinderMass * (height ** 2 / 12 + r2 / 4) +
		capsMass * ((2 * r2) / 5 + height ** 2 / 4 + (3 * height * radius) / 8)
	return {
		mass: cylinderMass + capsMass,
		center: new Vector3(),
		moments: new Vector3(transverse, transverse, axial),
	}
}

/** Solid-body inertia. A mesh is weighed as its bounding box, which overestimates any non-box. */
const shapeInertial = (shape: SimShape): ShapeInertial => {
	switch (shape.kind) {
		case 'box': {
			return boxInertial(shape.size, new Vector3())
		}
		case 'sphere': {
			const mass = DENSITY_KG_PER_M3 * (4 / 3) * Math.PI * shape.radius ** 3
			const moment = (2 / 5) * mass * shape.radius ** 2
			return { mass, center: new Vector3(), moments: new Vector3(moment, moment, moment) }
		}
		case 'cylinder': {
			const r2 = shape.radius ** 2
			const mass = DENSITY_KG_PER_M3 * Math.PI * r2 * shape.length
			const transverse = (mass * (3 * r2 + shape.length ** 2)) / 12
			return {
				mass,
				center: new Vector3(),
				moments: new Vector3(transverse, transverse, (mass * r2) / 2),
			}
		}
		case 'capsule': {
			return capsuleInertial(shape.radius, shape.length)
		}
		case 'mesh': {
			shape.geometry.computeBoundingBox()
			const bounds = shape.geometry.boundingBox ?? new Box3()
			return boxInertial(bounds.getSize(new Vector3()), bounds.getCenter(new Vector3()))
		}
		default: {
			const unreachable: never = shape
			return unreachable
		}
	}
}

/** `m (|d|² I − d dᵀ)`, the parallel-axis term for a mass `m` offset by `d`. */
const parallelAxis = (mass: number, offset: Vector3): Matrix3 => {
	const { x, y, z } = offset
	const squared = offset.lengthSq()
	return new Matrix3()
		.set(
			squared - x * x,
			-x * y,
			-x * z,
			-x * y,
			squared - y * y,
			-y * z,
			-x * z,
			-y * z,
			squared - z * z
		)
		.multiplyScalar(mass)
}

const addMatrix3 = (target: Matrix3, addend: Matrix3): void => {
	for (const [index, value] of addend.elements.entries()) target.elements[index] += value
}

/**
 * Mass properties for a body from its collision geoms, at the density of water. Visual-only geoms
 * have no say. A body with no collision geoms gets the placeholder mass and inertia.
 */
export const estimateInertial = (geoms: readonly SimGeom[]): SimInertial => {
	const parts = geoms
		.filter((geom) => geom.role !== 'visual')
		.map((geom) => {
			const part = shapeInertial(geom.shape)
			const rotation = new Matrix3().setFromMatrix4(geom.origin)
			const inertia = new Matrix3()
				.set(part.moments.x, 0, 0, 0, part.moments.y, 0, 0, 0, part.moments.z)
				.premultiply(rotation)
				.multiply(rotation.clone().transpose())
			return { mass: part.mass, center: part.center.applyMatrix4(geom.origin), inertia }
		})

	const mass = parts.reduce((sum, part) => sum + part.mass, 0)
	if (mass === 0) {
		const moment = PLACEHOLDER_INERTIA_KG_M2
		return {
			mass: PLACEHOLDER_MASS_KG,
			centerOfMass: new Vector3(),
			inertia: new Matrix3().set(moment, 0, 0, 0, moment, 0, 0, 0, moment),
		}
	}

	const centerOfMass = new Vector3()
	for (const part of parts) centerOfMass.addScaledVector(part.center, part.mass / mass)

	const inertia = new Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0)
	for (const part of parts) {
		addMatrix3(inertia, part.inertia)
		addMatrix3(inertia, parallelAxis(part.mass, part.center.clone().sub(centerOfMass)))
	}

	return { mass, centerOfMass, inertia }
}

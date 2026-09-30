import { Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { Pose } from '$lib/math'

import type { FrameDescriptor, FrameSystemJson } from '../frameDescriptors'
import type { TrajectoryStep } from '../jointPose'

import goldenFile from '../../../../tools/rdk-golden/motion/testdata/frame_descriptors_golden.json'
import { buildFrameDescriptors } from '../frameDescriptors'
import { descriptorLocalPose } from '../jointPose'

interface GoldenPose {
	point: { x: number; y: number; z: number }
	quaternion: { w: number; x: number; y: number; z: number }
}

interface GoldenProbe {
	inputs: TrajectoryStep
	frames: Record<string, GoldenPose>
	geometries: Record<string, GoldenPose>
}

const cases = goldenFile.cases as unknown as {
	name: string
	frameSystem: FrameSystemJson
	probes: GoldenProbe[]
}[]

const probeRows = cases.flatMap(({ name, frameSystem, probes }) =>
	probes.map((probe, index) => ({ name, frameSystem, probe, index }))
)

/** Millimetres. The scenes span about 1.5 m, and each side composes a dozen transforms. */
const MM_PLACES = 6
const QUATERNION_PLACES = 8
const M_TO_MM = 1000

const WORLD = 'world'

/**
 * Every descriptor's world matrix at `step`, composed up its `parent` chain. A parent with no
 * descriptor throws, since that frame would be drawn at the scene origin.
 */
const worldMatrices = (
	descriptors: FrameDescriptor[],
	step: TrajectoryStep
): Map<string, Matrix4> => {
	const byName = new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]))
	const matrices = new Map<string, Matrix4>([[WORLD, new Matrix4()]])

	const worldOf = (name: string): Matrix4 => {
		const known = matrices.get(name)
		if (known) return known

		const descriptor = byName.get(name)
		if (!descriptor) throw new Error(`no descriptor for frame "${name}"`)

		const matrix = worldOf(descriptor.parent)
			.clone()
			.multiply(descriptorLocalPose(descriptor, step).toMatrix4())
		matrices.set(name, matrix)
		return matrix
	}

	for (const descriptor of descriptors) worldOf(descriptor.name)
	return matrices
}

/**
 * `q` and `-q` are the same rotation, so the quaternion is flipped onto the golden's hemisphere
 * before components are compared.
 */
const closeToGolden = (matrix: Matrix4, golden: GoldenPose) => {
	const position = new Vector3()
	const rotation = new Quaternion()
	matrix.decompose(position, rotation, new Vector3())

	const { w, x, y, z } = golden.quaternion
	const sign = rotation.dot(new Quaternion(x, y, z, w)) < 0 ? -1 : 1

	return {
		actual: {
			point: { x: position.x * M_TO_MM, y: position.y * M_TO_MM, z: position.z * M_TO_MM },
			quaternion: {
				w: rotation.w * sign,
				x: rotation.x * sign,
				y: rotation.y * sign,
				z: rotation.z * sign,
			},
		},
		expected: {
			point: {
				x: expect.closeTo(golden.point.x, MM_PLACES),
				y: expect.closeTo(golden.point.y, MM_PLACES),
				z: expect.closeTo(golden.point.z, MM_PLACES),
			},
			quaternion: {
				w: expect.closeTo(w, QUATERNION_PLACES),
				x: expect.closeTo(x, QUATERNION_PLACES),
				y: expect.closeTo(y, QUATERNION_PLACES),
				z: expect.closeTo(z, QUATERNION_PLACES),
			},
		},
	}
}

const modelFrameNames = (frameSystem: FrameSystemJson): Set<string> =>
	new Set(
		Object.entries(frameSystem.frames)
			.filter(([, frame]) => frame.frame_type === 'model')
			.map(([name]) => name)
	)

describe('buildFrameDescriptors, against a frame system RDK marshaled', () => {
	it('reads both scenes the Go generator wrote', () => {
		expect(cases.length).toBe(2)
	})

	it.each(cases)('describes every frame of $name except its models', ({ frameSystem }) => {
		const models = modelFrameNames(frameSystem)
		const expected = Object.keys(frameSystem.frames).filter((name) => !models.has(name))

		const described = buildFrameDescriptors(frameSystem).map((descriptor) => descriptor.name)

		expect(described.toSorted()).toEqual(expected.toSorted())
	})
})

describe('buildFrameDescriptors composed to world, against FrameSystem.Transform', () => {
	it.each(probeRows)(
		'puts every frame of $name where RDK does at probe $index',
		({ frameSystem, probe }) => {
			const models = modelFrameNames(frameSystem)
			const matrices = worldMatrices(buildFrameDescriptors(frameSystem), probe.inputs)
			const rows = Object.entries(probe.frames)
				.filter(([name]) => !models.has(name))
				.map(([name, golden]) => [name, closeToGolden(matrices.get(name)!, golden)] as const)

			expect(Object.fromEntries(rows.map(([name, { actual }]) => [name, actual]))).toEqual(
				Object.fromEntries(rows.map(([name, { expected }]) => [name, expected]))
			)
		}
	)
})

describe('buildFrameDescriptors geometry centres, against FrameSystemGeometries', () => {
	it.each(probeRows)(
		'puts every geometry of $name where RDK does at probe $index',
		({ frameSystem, probe }) => {
			const descriptors = buildFrameDescriptors(frameSystem)
			const matrices = worldMatrices(descriptors, probe.inputs)
			const rows = descriptors.flatMap((descriptor) => {
				const golden = probe.geometries[descriptor.name]
				if (descriptor.kind !== 'static' || !descriptor.geometry || !golden) return []

				const center = new Pose().copy(descriptor.geometry.center).toMatrix4()
				const world = matrices.get(descriptor.name)!.clone().multiply(center)
				return [[descriptor.name, closeToGolden(world, golden)] as const]
			})

			expect(rows.map(([name]) => name).toSorted()).toEqual(
				Object.keys(probe.geometries).toSorted()
			)
			expect(Object.fromEntries(rows.map(([name, { actual }]) => [name, actual]))).toEqual(
				Object.fromEntries(rows.map(([name, { expected }]) => [name, expected]))
			)
		}
	)
})

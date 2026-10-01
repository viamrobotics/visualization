import { Matrix4, Quaternion, Vector3 } from 'three'
import { expect } from 'vitest'

import { Pose } from '$lib/math'

import type { FrameDescriptor, FrameSystemJson } from '../../frameDescriptors'
import type { TrajectoryStep } from '../../jointPose'

import goldenFile from '../../../../../tools/rdk-golden/motion/testdata/frame_descriptors_golden.json'
import { descriptorLocalPose } from '../../jointPose'

interface GoldenPose {
	point: { x: number; y: number; z: number }
	quaternion: { w: number; x: number; y: number; z: number }
}

export interface GoldenProbe {
	inputs: TrajectoryStep
	frames: Record<string, GoldenPose>
	geometries: Record<string, GoldenPose>
}

/**
 * One scene from `frame_descriptors_golden.json`: as RDK's `FrameSystem.MarshalJSON` writes it, as
 * the protojson of each `FrameSystemConfig` a robot would send for it, and where RDK puts every frame
 * and geometry at each probe.
 */
export interface FrameSystemGoldenCase {
	name: string
	frameSystem: FrameSystemJson
	parts: unknown[]
	/** Set on a scene with a link inside the orientation vector's pole radius but not on the pole. */
	nearPole: boolean
	probes: GoldenProbe[]
}

export const frameSystemGoldenCases = goldenFile.cases as unknown as FrameSystemGoldenCase[]

export const frameSystemGoldenProbes = frameSystemGoldenCases.flatMap((goldenCase) =>
	goldenCase.probes.map((probe, index) => ({ ...goldenCase, probe, index }))
)

interface Tolerance {
	mmPlaces: number
	quaternionPlaces: number
}

/** The scenes span about 1.5 m, and each side composes a dozen transforms. */
const EXACT_TOLERANCE: Tolerance = { mmPlaces: 6, quaternionPlaces: 8 }

/**
 * A `Pose` stores its orientation as a `common.v1.Pose` orientation vector, which treats a direction
 * within 1e-4 of a pole as on it and drops its longitude. RDK's frame system composes quaternions
 * and keeps that tilt, so a near-pole link comes back about 1e-6 rad off, up to 1e-3 mm at the tip.
 */
const NEAR_POLE_TOLERANCE: Tolerance = { mmPlaces: 2, quaternionPlaces: 5 }

const toleranceFor = (nearPole: boolean): Tolerance =>
	nearPole ? NEAR_POLE_TOLERANCE : EXACT_TOLERANCE

const M_TO_MM = 1000

const WORLD = 'world'

/**
 * RDK's model frames. `buildFrameDescriptors` emits no descriptor for one, so a model's pose is only
 * observable through the frames parented to it.
 */
export const modelFrameNames = (frameSystem: FrameSystemJson): Set<string> =>
	new Set(
		Object.entries(frameSystem.frames)
			.filter(([, frame]) => frame.frame_type === 'model')
			.map(([name]) => name)
	)

/** Every frame RDK marshaled that a descriptor should exist for. */
export const describableFrameNames = (frameSystem: FrameSystemJson): string[] => {
	const models = modelFrameNames(frameSystem)
	return Object.keys(frameSystem.frames).filter((name) => !models.has(name))
}

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
const poseAgainstGolden = (
	matrix: Matrix4,
	golden: GoldenPose,
	{ mmPlaces, quaternionPlaces }: Tolerance
) => {
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
				x: expect.closeTo(golden.point.x, mmPlaces),
				y: expect.closeTo(golden.point.y, mmPlaces),
				z: expect.closeTo(golden.point.z, mmPlaces),
			},
			quaternion: {
				w: expect.closeTo(w, quaternionPlaces),
				x: expect.closeTo(x, quaternionPlaces),
				y: expect.closeTo(y, quaternionPlaces),
				z: expect.closeTo(z, quaternionPlaces),
			},
		},
	}
}

type PoseRow = readonly [string, ReturnType<typeof poseAgainstGolden>]

/** Two name-keyed maps shaped for one `toEqual`, so a failure lists every frame that disagrees. */
const actualAndExpected = (rows: PoseRow[]) => ({
	actual: Object.fromEntries(rows.map(([name, { actual }]) => [name, actual])),
	expected: Object.fromEntries(rows.map(([name, { expected }]) => [name, expected])),
})

/** Each non-model frame's world pose from `descriptors`, beside where RDK put it. */
export const framePosesAgainstGolden = (
	descriptors: FrameDescriptor[],
	{
		frameSystem,
		probe,
		nearPole,
	}: Pick<FrameSystemGoldenCase, 'frameSystem' | 'nearPole'> & { probe: GoldenProbe }
) => {
	const models = modelFrameNames(frameSystem)
	const matrices = worldMatrices(descriptors, probe.inputs)
	const tolerance = toleranceFor(nearPole)

	return actualAndExpected(
		Object.entries(probe.frames)
			.filter(([name]) => !models.has(name))
			.map(
				([name, golden]) =>
					[name, poseAgainstGolden(matrices.get(name)!, golden, tolerance)] as const
			)
	)
}

/**
 * Each geometry's world pose from `descriptors`, beside where RDK put it, plus the names of the
 * frames that carried one. RDK labels a geometry with the frame that owns it.
 */
export const geometryPosesAgainstGolden = (
	descriptors: FrameDescriptor[],
	{ probe, nearPole }: Pick<FrameSystemGoldenCase, 'nearPole'> & { probe: GoldenProbe }
) => {
	const matrices = worldMatrices(descriptors, probe.inputs)
	const tolerance = toleranceFor(nearPole)
	const rows = descriptors.flatMap((descriptor): PoseRow[] => {
		const golden = probe.geometries[descriptor.name]
		if (descriptor.kind !== 'static' || !descriptor.geometry || !golden) return []

		const center = new Pose().copy(descriptor.geometry.center).toMatrix4()
		const world = matrices.get(descriptor.name)!.clone().multiply(center)
		return [[descriptor.name, poseAgainstGolden(world, golden, tolerance)]]
	})

	return { names: rows.map(([name]) => name), ...actualAndExpected(rows) }
}

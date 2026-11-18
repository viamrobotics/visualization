import type { PartComponent, PartModule } from '$lib/hooks/usePartConfig.svelte'

import { Pose } from '$lib/math'

export const ARM_POSITION_SAVER_MODEL = 'erh:vmodutils:arm-position-saver'

const SWITCH_API = 'rdk:component:switch'

/** The `modules` entry that loads `ARM_POSITION_SAVER_MODEL` from the registry. */
export const VMODUTILS_MODULE: PartModule = {
	type: 'registry',
	name: 'erh_vmodutils',
	module_id: 'erh:vmodutils',
	version: 'latest',
}

/** A saver as the visualizer reads it. See `traits.SavedPose` for the units. */
export interface ArmPositionSaver {
	name: string
	arm: string
	/** The motion service that plans moves around obstacles, or `''` for a direct joint move. */
	motion: string
	joints?: number[]
	pose?: Pose
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const finiteNumber = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) ? value : undefined

const parseJoints = (value: unknown): number[] | undefined => {
	if (!Array.isArray(value) || value.length === 0) return undefined
	const joints = value.map((joint) => finiteNumber(joint))
	return joints.every((joint) => joint !== undefined) ? (joints as number[]) : undefined
}

/**
 * The module writes `point` from Go's `r3.Vector`, which has no JSON tags, so its keys arrive
 * capitalized. `orientation` is `OrientationVectorDegrees`, which tags them lowercase.
 */
const parsePose = (point: unknown, orientation: unknown): Pose | undefined => {
	if (!isRecord(point)) return undefined

	const x = finiteNumber(point['X']) ?? 0
	const y = finiteNumber(point['Y']) ?? 0
	const z = finiteNumber(point['Z']) ?? 0
	const ov = isRecord(orientation) ? orientation : {}

	return new Pose(
		x,
		y,
		z,
		finiteNumber(ov['x']),
		finiteNumber(ov['y']),
		finiteNumber(ov['z']),
		finiteNumber(ov['th']) ?? 0
	)
}

/**
 * The saver `component` configures, or `undefined` when it is not one.
 *
 * Mirrors the module's own precedence: saved `joints` win, and a pose is used only without them.
 */
export const parseArmPositionSaver = (component: PartComponent): ArmPositionSaver | undefined => {
	if (component.model !== ARM_POSITION_SAVER_MODEL) return undefined

	const attributes = component.attributes ?? {}
	const arm = attributes['arm']
	if (typeof arm !== 'string' || arm === '') return undefined

	const motion = typeof attributes['motion'] === 'string' ? attributes['motion'] : ''

	const joints = parseJoints(attributes['joints'])
	if (joints) return { name: component.name, arm, motion, joints }

	return {
		name: component.name,
		arm,
		motion,
		pose: parsePose(attributes['point'], attributes['orientation']),
	}
}

/**
 * A saver that will drive `arm` back to `joints`, planned around obstacles by `motion`. An empty
 * `motion` leaves the attribute out, and the module then moves the joints directly.
 */
export const createArmPositionSaver = (
	name: string,
	arm: string,
	joints: number[],
	motion: string
): PartComponent => ({
	name,
	api: SWITCH_API,
	model: ARM_POSITION_SAVER_MODEL,
	attributes: motion === '' ? { arm, joints } : { arm, joints, motion },
})

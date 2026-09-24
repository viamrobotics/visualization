import { describe, expect, it, vi } from 'vitest'

import { parsePlan, PlanParseError } from '../parse-plan'
import { parsedPlanToSnapshots } from '../plan-to-snapshots'
import capturedPlan from './__fixtures__/plan.json?raw'

const MINIMAL_FRAME_SYSTEM = {
	frames: {
		'left-arm': {
			frame_type: 'model',
			frame: { name: 'left-arm', model: { joints: [{ id: 'waist' }] } },
		},
		'left-arm:waist': {
			frame_type: 'named',
			frame: {
				inner_frame: {
					frame_type: 'rotational',
					frame: { axis: { X: 0, Y: 0, Z: 1 } },
				},
			},
		},
	},
	parents: { 'left-arm:waist': 'world' },
}

const REQUEST_OBJ = { frame_system: MINIMAL_FRAME_SYSTEM, goals: [], start_state: {} }
const RESULT_OBJ = { trajectory: [{ 'left-arm': [0.5] }] }

describe('parsePlan', () => {
	it('parses a single-object plan (no trajectory)', () => {
		const plan = parsePlan(JSON.stringify(REQUEST_OBJ))
		expect(Object.keys(plan.frames)).toContain('left-arm:waist')
		expect(plan.trajectory).toHaveLength(0)
	})

	it('parses two concatenated JSON objects', () => {
		const content = JSON.stringify(REQUEST_OBJ) + JSON.stringify(RESULT_OBJ)
		const plan = parsePlan(content)
		expect(plan.trajectory).toHaveLength(1)
		expect(plan.trajectory[0]!['left-arm']).toEqual([0.5])
	})

	it('throws PlanParseError when frame_system is absent', () => {
		expect(() => parsePlan(JSON.stringify({ path: [], trajectory: [] }))).toThrow(PlanParseError)
	})

	it('throws PlanParseError on invalid JSON', () => {
		expect(() => parsePlan('{ not valid json')).toThrow(PlanParseError)
	})

	it('throws PlanParseError when a chunk has wrong types', () => {
		expect(() =>
			parsePlan(JSON.stringify({ frame_system: MINIMAL_FRAME_SYSTEM, trajectory: 'bad' }))
		).toThrow(PlanParseError)
	})

	it('keeps the two obstacle keys on separate fields', () => {
		const plan = parsePlan(
			JSON.stringify({
				...REQUEST_OBJ,
				world_state: { obstacles: [] },
				obstacles_in_world_frame: { frame: 'shelf', geometries: [] },
			}) + JSON.stringify(RESULT_OBJ)
		)
		expect(plan.worldState).toEqual({ obstacles: [] })
		expect(plan.obstaclesInWorldFrame).toEqual({ frame: 'shelf', geometries: [] })
	})

	it('defaults an obstacles_in_world_frame with no parent to world', () => {
		const plan = parsePlan(
			JSON.stringify({ ...REQUEST_OBJ, obstacles_in_world_frame: { geometries: [] } }) +
				JSON.stringify(RESULT_OBJ)
		)
		expect(plan.obstaclesInWorldFrame?.frame).toBe('world')
	})

	// Must fail here rather than deep inside the geometry decoder, where there is no path to report.
	it('throws PlanParseError when obstacles_in_world_frame is malformed', () => {
		expect(() =>
			parsePlan(
				JSON.stringify({ ...REQUEST_OBJ, obstacles_in_world_frame: { geometries: 'nope' } })
			)
		).toThrow(PlanParseError)
	})
})

/**
 * `plan.json` is an unmodified capture of a two-armed rig lowering to a cup —
 * the same file a user drags into the tool. It is deliberately not touched up,
 * so these assertions describe what real plans actually contain.
 */
describe('parsePlan with a captured plan', () => {
	const plan = parsePlan(capturedPlan)

	it('reads the frame system and the trajectory from the two concatenated objects', () => {
		expect(Object.keys(plan.frames)).toHaveLength(79)
		expect(Object.keys(plan.parents)).toHaveLength(79)
		expect(plan.goals).toHaveLength(1)
		expect(plan.trajectory).toHaveLength(2)
	})

	it('keeps every frame type the planner emits', () => {
		const counts: Record<string, number> = {}
		for (const { frame_type } of Object.values(plan.frames)) {
			counts[frame_type] = (counts[frame_type] ?? 0) + 1
		}

		expect(counts).toEqual({ static: 4, tail_geometry_static: 19, model: 15, named: 41 })
	})

	it('keeps the empty joint arrays that static frames carry in every step', () => {
		const step = plan.trajectory[0]!
		const moving = Object.entries(step).filter(([, joints]) => joints.length > 0)

		// Only the two arms articulate. The other 36 frames ride along with an empty array, which is the shape the descriptor builder relies on.
		expect(Object.keys(step)).toHaveLength(38)
		expect(moving.map(([name]) => name)).toEqual(['left-arm', 'right-arm'])
		expect(step['left-arm']).toHaveLength(6)
	})

	it('ignores the planner keys the replayer does not read', () => {
		// The capture also carries world_state, constraints, planner_options, start_state and path. Parsing must not reject them.
		expect(plan.frames['obstacle-table']).toBeDefined()
	})

	// Skipping a geometry is warn-only, so the warning is the contract. A geometry that stops parsing would otherwise vanish from the scene.
	it('builds every geometry in the capture without skipping one', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		parsedPlanToSnapshots(parsePlan(capturedPlan))

		expect(warn).not.toHaveBeenCalled()
		warn.mockRestore()
	})
})

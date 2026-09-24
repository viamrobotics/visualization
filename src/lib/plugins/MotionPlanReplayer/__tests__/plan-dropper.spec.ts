import { describe, expect, it, vi } from 'vitest'

import { Transform } from '$lib/buf/common/v1/common_pb'

import { planDropper } from '../plan-dropper'
import { transformsToSnapshot } from '../plan-to-snapshots'

const REQUEST_OBJ = {
	frame_system: {
		frames: {
			'left-arm:waist': {
				frame_type: 'named',
				frame: {
					inner_frame: { frame_type: 'rotational', frame: { axis: { X: 0, Y: 0, Z: 1 } } },
				},
			},
		},
		parents: { 'left-arm:waist': 'world' },
	},
	goals: [],
	start_state: {},
}
const RESULT_OBJ = { trajectory: [{ 'left-arm': [0.5] }] }
const VALID_PLAN = JSON.stringify(REQUEST_OBJ) + JSON.stringify(RESULT_OBJ)
const ZERO_AXIS_PLAN =
	JSON.stringify({
		frame_system: {
			frames: {
				'left-arm': {
					frame_type: 'model',
					frame: { name: 'left-arm', model: { joints: [{ id: 'waist' }] } },
				},
				'left-arm:waist': {
					frame_type: 'named',
					frame: {
						inner_frame: { frame_type: 'rotational', frame: { axis: { X: 0, Y: 0, Z: 0 } } },
					},
				},
			},
			parents: { 'left-arm:waist': 'world' },
		},
		goals: [],
		start_state: {},
	}) + JSON.stringify(RESULT_OBJ)

const serverSnapshots = () => [
	transformsToSnapshot([new Transform({ referenceFrame: 'server-frame' })]),
]

describe('planDropper', () => {
	it('fails when content is not a string', async () => {
		const result = await planDropper({ name: 'plan.json', content: null })
		expect(result.success).toBe(false)
	})

	it('parses on the client when no resolver is supplied', async () => {
		const result = await planDropper({ name: 'plan.json', content: VALID_PLAN })
		expect(result.success).toBe(true)
	})

	it('names the file and the reason when a frame cannot be drawn', async () => {
		const result = await planDropper({ name: 'plan.json', content: ZERO_AXIS_PLAN })

		expect(result.success).toBe(false)
		if (result.success) return
		expect(result.error.message).toBe(
			'"plan.json" could not be read: joint "left-arm:waist" has a zero-length axis'
		)
	})

	it('uses resolver-returned snapshots without parsing on the client', async () => {
		const resolvePlanSnapshots = vi.fn().mockResolvedValue(serverSnapshots())
		const result = await planDropper({
			name: 'plan.json',
			content: 'not even valid json',
			resolvePlanSnapshots,
		})

		expect(resolvePlanSnapshots).toHaveBeenCalledWith('plan.json', 'not even valid json')
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.snapshots[0]!.transforms[0]!.referenceFrame).toBe('server-frame')
		}
	})

	it('falls back to the client parse when the resolver returns undefined', async () => {
		const resolvePlanSnapshots = vi.fn().mockResolvedValue(undefined)
		const result = await planDropper({
			name: 'plan.json',
			content: VALID_PLAN,
			resolvePlanSnapshots,
		})

		expect(resolvePlanSnapshots).toHaveBeenCalled()
		expect(result.success).toBe(true)
		if (result.success) {
			const frames = result.snapshots.flatMap((s) => s.transforms.map((t) => t.referenceFrame))
			expect(frames).not.toContain('server-frame')
		}
	})

	it('falls back to the client parse when the resolver throws', async () => {
		const resolvePlanSnapshots = vi.fn().mockRejectedValue(new Error('route down'))
		const result = await planDropper({
			name: 'plan.json',
			content: VALID_PLAN,
			resolvePlanSnapshots,
		})

		expect(result.success).toBe(true)
	})

	it('fails only when the resolver AND the client parse both fail', async () => {
		const resolvePlanSnapshots = vi.fn().mockRejectedValue(new Error('route down'))
		const result = await planDropper({
			name: 'plan.json',
			content: 'not even valid json',
			resolvePlanSnapshots,
		})

		expect(result.success).toBe(false)
	})
})

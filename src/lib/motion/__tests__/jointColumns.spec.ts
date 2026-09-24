import { describe, expect, it, vi } from 'vitest'

import type { JointJson, ModelJson } from '../jointColumns'

import gripperModel from '../../plugins/MotionPlanReplayer/__tests__/__fixtures__/rdk-mimic-gripper-model.json'
import serialModel from '../../plugins/MotionPlanReplayer/__tests__/__fixtures__/rdk-mimic-serial-model.json'
import { modelJointColumns } from '../jointColumns'

const columnsOf = (model: ModelJson) => modelJointColumns(model, 'test-model').columns

/**
 * A serial chain, where schema order and declaration order agree: it holds ordering still while
 * the mimic rule is tested.
 */
const chain = (...joints: JointJson[]): ModelJson => ({
	joints: joints.map((joint, index) => ({
		...joint,
		parent: index === 0 ? 'world' : joints[index - 1]!.id,
	})),
})

const indices = (model: ModelJson): Record<string, number | undefined> => {
	const columns = columnsOf(model)
	return Object.fromEntries((model.joints ?? []).map((j) => [j.id, columns.get(j.id!)?.index]))
}

describe('joints with no mimic among them', () => {
	it('numbers them down the chain', () => {
		expect(indices(chain({ id: 'a' }, { id: 'b' }, { id: 'c' }))).toEqual({ a: 0, b: 1, c: 2 })
	})

	it('gives every joint a column and no mapping', () => {
		const columns = columnsOf(chain({ id: 'a' }, { id: 'b' }))
		// `every` is vacuously true on an empty map, so the size is what makes this an assertion.
		expect(columns.size).toBe(2)
		expect([...columns.values()].every((c) => c.mimic === undefined)).toBe(true)
	})
})

// Byte-for-byte copies of `referenceframe/testfiles/`. The DoF counts are the ones
// `TestMimicGripperModel` and `TestMimicSerialModel` assert, and DoF is exactly the column count.
describe("RDK's own mimic models", () => {
	it('gives the gripper one column, shared by both fingers', () => {
		const columns = columnsOf(gripperModel)

		expect(columns.get('left_joint')).toEqual({ index: 0 })
		expect(columns.get('right_joint')).toEqual({ index: 0, mimic: { multiplier: 1, offset: 0 } })
		expect(new Set([...columns.values()].map((c) => c.index)).size).toBe(1)
	})

	it('gives the serial arm two columns and drives its third joint from the first', () => {
		const columns = columnsOf(serialModel)

		expect(columns.get('joint1')).toEqual({ index: 0 })
		expect(columns.get('joint2')).toEqual({ index: 1 })
		expect(columns.get('joint3')).toEqual({ index: 0, mimic: { multiplier: -1, offset: 0 } })
	})
})

describe('a mimic joint in the middle of a chain', () => {
	const model = chain(
		{ id: 'shoulder' },
		{ id: 'knuckle', mimic: { joint: 'shoulder' } },
		{ id: 'elbow' },
		{ id: 'wrist' }
	)

	it('shifts every joint below it up one column', () => {
		expect(indices(model)).toEqual({ shoulder: 0, knuckle: 0, elbow: 1, wrist: 2 })
	})

	it('leaves the columns contiguous from zero', () => {
		const owned = [...columnsOf(model)]
			.filter(([, column]) => !column.mimic)
			.map(([, column]) => column.index)

		expect(owned.toSorted((a, b) => a - b)).toEqual([0, 1, 2])
	})

	// Every other case here mimics the first joint, where `index: source.index` and a hardcoded `0`
	// agree. This is the only one that borrows a column that is not zero.
	it("borrows the source's own column, not the first one", () => {
		const columns = columnsOf(
			chain(
				{ id: 'first' },
				{ id: 'second' },
				{ id: 'follows_second', mimic: { joint: 'second' } },
				{ id: 'after' }
			)
		)

		expect(columns.get('follows_second')).toEqual({
			index: 1,
			mimic: { multiplier: 1, offset: 0 },
		})
		expect(columns.get('after')).toEqual({ index: 2 })
	})
})

describe('the linear map a mimic applies', () => {
	it('reads a multiplier and an offset off the joint', () => {
		const columns = columnsOf(
			chain(
				{ id: 'drive' },
				{ id: 'follower', mimic: { joint: 'drive', multiplier: 0.5, offset: 2 } }
			)
		)

		expect(columns.get('follower')?.mimic).toEqual({ multiplier: 0.5, offset: 2 })
	})

	// `omitempty` means an absent multiplier and an explicit 0 arrive identically.
	it.each([undefined, 0])('reads a %s multiplier as 1', (multiplier) => {
		const columns = columnsOf(
			chain({ id: 'drive' }, { id: 'follower', mimic: { joint: 'drive', multiplier, offset: 3 } })
		)

		expect(columns.get('follower')?.mimic).toEqual({ multiplier: 1, offset: 3 })
	})

	it('composes a chain down to the joint that owns the column', () => {
		const columns = columnsOf(
			chain(
				{ id: 'c' },
				{ id: 'b', mimic: { joint: 'c', multiplier: 3, offset: 5 } },
				{ id: 'a', mimic: { joint: 'b', multiplier: 2, offset: 1 } }
			)
		)

		expect(columns.get('a')).toEqual({ index: 0, mimic: { multiplier: 6, offset: 11 } })
		expect(columns.get('b')).toEqual({ index: 0, mimic: { multiplier: 3, offset: 5 } })
	})
})

describe('mimics that name no reachable source', () => {
	it('drops a joint whose source does not exist', () => {
		const columns = columnsOf(chain({ id: 'a' }, { id: 'b', mimic: { joint: 'ghost' } }))

		expect(columns.has('b')).toBe(false)
		expect(columns.get('a')).toEqual({ index: 0 })
	})

	it('drops both halves of a cycle rather than looping', () => {
		const columns = columnsOf(
			chain({ id: 'a', mimic: { joint: 'b' } }, { id: 'b', mimic: { joint: 'a' } })
		)

		expect([...columns.keys()]).toEqual([])
	})

	it('drops a joint that mimics itself', () => {
		expect(columnsOf(chain({ id: 'a', mimic: { joint: 'a' } })).has('a')).toBe(false)
	})
})

// Go marshals `JointConfig.ID`'s zero value rather than omitting it, so `''` is the shape that
// actually arrives, not the missing key.
describe('a node with no usable name', () => {
	it.each([
		['an absent id', { id: undefined }],
		['an empty id', { id: '' }],
	])('drops a joint with %s rather than giving it a column', (_label, broken) => {
		const model: ModelJson = {
			joints: [
				{ id: 'a', parent: 'world' },
				{ ...broken, parent: 'a' },
				{ id: 'c', parent: 'a' },
			],
		}
		expect(modelJointColumns(model, 'test-model').order).toEqual(['a', 'c'])
	})

	it.each([
		['an absent parent', { parent: undefined }],
		['an empty parent', { parent: '' }],
	])('roots a joint with %s at the model', (_label, rooted) => {
		const model: ModelJson = {
			output_frames: ['b'],
			joints: [
				{ id: 'b', parent: 'world' },
				{ id: 'a', ...rooted },
			],
		}
		expect(modelJointColumns(model, 'test-model').order).toEqual(['a', 'b'])
	})
})

// `gamma_joint` is what separates breadth from depth: with one joint below the last-sorted branch,
// a depth-first walk gives the same sequence and the fixture pins nothing.
describe('a model whose declaration order is not its chain order', () => {
	const model: ModelJson = {
		output_frames: ['beta_joint'],
		links: [
			{ id: 'base', parent: 'world' },
			{ id: 'alpha_link', parent: 'alpha_joint' },
			{ id: 'zeta_link', parent: 'zeta_joint' },
		],
		joints: [
			{ id: 'zeta_joint', parent: 'base' },
			{ id: 'alpha_joint', parent: 'base' },
			{ id: 'beta_joint', parent: 'zeta_link' },
			{ id: 'gamma_joint', parent: 'alpha_link' },
		],
	}

	it('numbers the two branches alphabetically rather than as declared', () => {
		expect(indices(model)).toEqual({
			alpha_joint: 0,
			zeta_joint: 1,
			gamma_joint: 2,
			beta_joint: 3,
		})
	})

	it('finishes a whole breadth before descending', () => {
		expect(modelJointColumns(model, 'test-model').order).toEqual([
			'alpha_joint',
			'zeta_joint',
			'gamma_joint',
			'beta_joint',
		])
	})
})

describe('a branched model with a mimic in one branch', () => {
	const model: ModelJson = {
		output_frames: ['beta_joint'],
		links: [
			{ id: 'base', parent: 'world' },
			{ id: 'alpha_link', parent: 'alpha_joint' },
			{ id: 'zeta_link', parent: 'zeta_joint' },
		],
		joints: [
			{ id: 'zeta_joint', parent: 'base' },
			{ id: 'alpha_joint', parent: 'base' },
			{ id: 'omega_joint', parent: 'alpha_link', mimic: { joint: 'alpha_joint', multiplier: -1 } },
			{ id: 'beta_joint', parent: 'zeta_link' },
		],
	}

	it('numbers by the walk and skips the mimic while doing it', () => {
		expect(indices(model)).toEqual({
			alpha_joint: 0,
			zeta_joint: 1,
			omega_joint: 0,
			beta_joint: 2,
		})
	})

	it('points the mimic at the column of the joint it follows', () => {
		expect(columnsOf(model).get('omega_joint')).toEqual({
			index: 0,
			mimic: { multiplier: -1, offset: 0 },
		})
	})

	it('keeps the mimic in the order it walked', () => {
		expect(modelJointColumns(model, 'test-model').order).toEqual([
			'alpha_joint',
			'zeta_joint',
			'omega_joint',
			'beta_joint',
		])
	})
})

describe('a joint whose parent is not a declared node', () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

	const model: ModelJson = {
		output_frames: ['attached'],
		links: [{ id: 'base', parent: 'world' }],
		joints: [
			{ id: 'attached', parent: 'base' },
			{ id: 'orphan', parent: 'nowhere' },
		],
	}

	it('roots it at the model, so it sorts ahead of the real base', () => {
		expect(indices(model)).toEqual({ orphan: 0, attached: 1 })
	})

	it('says nothing, because nothing was guessed', () => {
		modelJointColumns(model, 'test-model')
		expect(warn).not.toHaveBeenCalled()
	})
})

// RDK refuses to build a cycle (`ErrCircularReference`), so this is a floor under malformed input,
// not a path real data takes.
describe('joints the walk cannot reach at all', () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

	const model: ModelJson = {
		links: [{ id: 'base', parent: 'world' }],
		joints: [
			{ id: 'attached', parent: 'base' },
			{ id: 'ouro', parent: 'boros' },
			{ id: 'boros', parent: 'ouro' },
		],
	}

	it('keeps them, in declaration order, after everything it did reach', () => {
		expect(modelJointColumns(model, 'test-model').order).toEqual(['attached', 'ouro', 'boros'])
		expect(indices(model)).toEqual({ attached: 0, ouro: 1, boros: 2 })
	})

	it('names every one of them, the model, and that the columns are a guess', () => {
		modelJointColumns(model, 'test-model')
		expect(warn).toHaveBeenCalledWith(
			'[motion] joints ouro, boros on "test-model" are not connected to its base — their trajectory columns are a guess'
		)
	})
})

import { Constraints, WorldState } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { parseMoveOptions } from '../parseMoveOptions'

describe('parseMoveOptions', () => {
	it('omits empty and whitespace-only fields', () => {
		expect(parseMoveOptions('', ' \n\t ')).toEqual({
			worldState: undefined,
			constraints: undefined,
		})
	})

	it('parses valid JSON into the generated messages', () => {
		const result = parseMoveOptions('{"transforms": []}', '{"linearConstraint": []}')

		expect(result.worldState).toBeInstanceOf(WorldState)
		expect(result.worldState?.transforms).toEqual([])
		expect(result.constraints).toBeInstanceOf(Constraints)
		expect(result.constraints?.linearConstraint).toEqual([])
	})

	it.each([
		['world state', '{', ''],
		['constraints', '', '{'],
	])('throws when the %s field contains malformed JSON', (_field, worldState, constraints) => {
		expect(() => parseMoveOptions(worldState, constraints)).toThrow()
	})
})

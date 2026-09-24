import { describe, expect, it } from 'vitest'

import {
	assignArmBits,
	ENVIRONMENT_BIT,
	groupsForBit,
	interactionGroups,
} from '../interactionGroups'

/**
 * Rapier's own compatibility rule: two colliders interact when each one's
 * membership half intersects the other's filter half. Reimplemented here so the
 * tests assert the behaviour that matters rather than the bit layout.
 */
const interacts = (a: number, b: number): boolean => {
	const membershipsA = a >>> 16
	const filterA = a & 0xff_ff
	const membershipsB = b >>> 16
	const filterB = b & 0xff_ff
	return (membershipsA & filterB) !== 0 && (membershipsB & filterA) !== 0
}

describe('interactionGroups', () => {
	it('packs memberships into the high half and the filter into the low half', () => {
		expect(interactionGroups(0b1, 0b10)).toBe(0x0001_0002)
	})

	it('stays unsigned when the top membership bit is set', () => {
		expect(interactionGroups(1 << 15, 0xff_ff)).toBeGreaterThan(0)
	})
})

describe('assignArmBits', () => {
	it('gives each arm its own bit, starting above the environment', () => {
		expect([...assignArmBits(['left', 'right']).entries()]).toEqual([
			['left', 1],
			['right', 2],
		])
	})

	it('ignores duplicate names', () => {
		expect(assignArmBits(['arm', 'arm']).size).toBe(1)
	})

	it('shares the last bit once the 15 available run out', () => {
		const names = Array.from({ length: 20 }, (_, index) => `arm${index}`)
		const bits = assignArmBits(names)

		expect(bits.get('arm14')).toBe(15)
		expect(bits.get('arm19')).toBe(15)
	})
})

describe('groupsForBit', () => {
	const environment = groupsForBit(ENVIRONMENT_BIT)
	const armOne = groupsForBit(1)
	const armTwo = groupsForBit(2)

	it('never tests an arm against its own links', () => {
		expect(interacts(armOne, armOne)).toBe(false)
	})

	it('tests two different arms against each other', () => {
		expect(interacts(armOne, armTwo)).toBe(true)
	})

	it('tests every arm against the environment', () => {
		expect(interacts(armOne, environment)).toBe(true)
		expect(interacts(armTwo, environment)).toBe(true)
	})

	it('never tests the environment against itself, so scenery resting on scenery stays quiet', () => {
		expect(interacts(environment, environment)).toBe(false)
	})

	it('lumps arms sharing the overflow bit together, under-reporting rather than lying', () => {
		expect(interacts(groupsForBit(15), groupsForBit(15))).toBe(false)
	})
})

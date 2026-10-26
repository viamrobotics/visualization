import { createWorld, type Entity } from 'koota'
import { beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import { previewName } from '$lib/plugins/MoveFrame/previewNames'
import { GhostOf } from '$lib/plugins/MoveFrame/relations'
import { PreviewGhost } from '$lib/plugins/MoveFrame/traits'

import type { CollisionPair } from '../collisionWorld'

import { toReports } from '../collisionReport'

let world: ReturnType<typeof createWorld>

beforeEach(() => {
	world = createWorld()
})

const live = (name: string) => world.spawn(traits.Name(name))

const stagedGhost = (source: Entity) => world.spawn(GhostOf(source))

const previewTwin = (name: string) => world.spawn(traits.Name(previewName(name)), PreviewGhost)

const pair = (a: Entity, b: Entity, depth = 0.01): CollisionPair => ({
	a,
	b,
	depth,
	point: { x: 0, y: 0, z: 0 },
})

const names = (pairs: CollisionPair[]) =>
	toReports(pairs).map((report) => [report.a.name, report.b.name, report.staged])

describe('toReports', () => {
	it('names both sides of a live pair', () => {
		expect(names([pair(live('arm:link'), live('table'))])).toEqual([['arm:link', 'table', false]])
	})

	it('reads a preview twin as the live frame it mirrors, not by its internal name', () => {
		const reports = toReports([pair(previewTwin('arm:link'), live('table'))])

		expect(reports[0]?.a.name).toBe('arm:link')
	})

	it('marks a pair a preview would hit as staged', () => {
		const reports = toReports([pair(previewTwin('arm:link'), live('table'))])

		expect(reports[0]?.staged).toBe(true)
	})

	it("borrows a staged-move ghost's name from the entity it copies", () => {
		const gripper = live('gripper')

		expect(names([pair(stagedGhost(gripper), live('table'))])).toEqual([['gripper', 'table', true]])
	})

	it("links a staged-move ghost's side to the entity it copies, which has a row to select", () => {
		const gripper = live('gripper')

		const reports = toReports([pair(stagedGhost(gripper), live('table'))])

		expect(reports[0]?.a.entity).toBe(gripper)
	})

	it('puts staged pairs first, since a move that would collide is the more urgent warning', () => {
		const reports = toReports([
			pair(live('arm:link'), live('table')),
			pair(previewTwin('arm:wrist'), live('shelf')),
		])

		expect(reports.map((report) => report.staged)).toEqual([true, false])
	})

	it('collapses a pair reported from both colliders', () => {
		const link = live('arm:link')
		const table = live('table')

		expect(toReports([pair(link, table), pair(table, link)])).toHaveLength(1)
	})

	it('keeps the deepest of the colliders that share a pair of names', () => {
		const table = live('table')
		const shallow = pair(live('arm'), table, 0.002)
		const deep = pair(live('arm'), table, 0.009)

		expect(toReports([shallow, deep, shallow])[0]?.depth).toBe(0.009)
	})

	it('keys a pair the same whichever side Rapier reported first', () => {
		const link = live('arm:link')
		const table = live('table')

		expect(toReports([pair(table, link)])[0]?.key).toBe(toReports([pair(link, table)])[0]?.key)
	})

	it('keys a staged pair apart from a live pair with the same names', () => {
		const gripper = live('gripper')
		const table = live('table')

		const reports = toReports([pair(gripper, table), pair(stagedGhost(gripper), table)])

		expect(reports).toHaveLength(2)
	})

	it('falls back to a placeholder for a ghost whose source is gone', () => {
		const gone = live('gripper')
		const ghost = stagedGhost(gone)
		gone.destroy()

		// Destroying the source drops the `GhostOf` relation with it, so `isGhost` reads false here and
		// the pair reports as live. The placeholder name is what this test pins.
		expect(names([pair(ghost, live('table'))])).toEqual([['table', 'unnamed', false]])
	})
})

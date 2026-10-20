import { createWorld, type Entity } from 'koota'
import { beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import { previewName } from '../../previewNames'
import { GhostOf } from '../../relations'
import { PreviewGhost } from '../../traits'
import { toReports } from '../collisionReport'

let world: ReturnType<typeof createWorld>

beforeEach(() => {
	world = createWorld()
})

const live = (name: string) => world.spawn(traits.Name(name))

const stagedGhost = (source: Entity) => world.spawn(GhostOf(source))

const previewTwin = (name: string) => world.spawn(traits.Name(previewName(name)), PreviewGhost)

describe('toReports', () => {
	it('names both sides of a live pair', () => {
		const reports = toReports([{ a: live('arm:link'), b: live('table') }])

		expect(reports).toEqual([{ a: 'arm:link', b: 'table', staged: false }])
	})

	it('reads a preview twin as the live frame it mirrors, not by its internal name', () => {
		const reports = toReports([{ a: previewTwin('arm:link'), b: live('table') }])

		expect(reports[0]?.a).toBe('arm:link')
	})

	it('marks a pair a preview would hit as staged', () => {
		const reports = toReports([{ a: previewTwin('arm:link'), b: live('table') }])

		expect(reports[0]?.staged).toBe(true)
	})

	it("borrows a staged-move ghost's name from the entity it copies", () => {
		const gripper = live('gripper')
		const reports = toReports([{ a: stagedGhost(gripper), b: live('table') }])

		expect(reports).toEqual([{ a: 'gripper', b: 'table', staged: true }])
	})

	it('puts staged pairs first, since a move that would collide is the more urgent warning', () => {
		const reports = toReports([
			{ a: live('arm:link'), b: live('table') },
			{ a: previewTwin('arm:wrist'), b: live('shelf') },
		])

		expect(reports.map((report) => report.staged)).toEqual([true, false])
	})

	it('collapses a pair reported from both colliders', () => {
		const link = live('arm:link')
		const table = live('table')
		const reports = toReports([
			{ a: link, b: table },
			{ a: table, b: link },
		])

		expect(reports).toHaveLength(1)
	})

	it('falls back to a placeholder for a ghost whose source is gone', () => {
		const gone = live('gripper')
		const ghost = stagedGhost(gone)
		gone.destroy()

		// Destroying the source drops the `GhostOf` relation with it, so `isGhost` reads false here and
		// the pair reports as live. The placeholder name is what this test pins.
		expect(toReports([{ a: ghost, b: live('table') }])).toEqual([
			{ a: 'table', b: 'unnamed', staged: false },
		])
	})
})

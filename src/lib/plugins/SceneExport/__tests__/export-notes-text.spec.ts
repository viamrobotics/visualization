import { describe, expect, it } from 'vitest'

import { countExportNotes } from '../export-notes-text'

describe('countExportNotes', () => {
	it('counts each listed subject once, as export-notes.txt lists them', () => {
		const notes = [
			{ reason: 'mujoco-hulls-collision-mesh', subject: 'table' },
			{ reason: 'mujoco-hulls-collision-mesh', subject: 'table' },
			{ reason: 'inertia-estimated', subject: 'URDF' },
			{ reason: 'inertia-estimated', subject: 'MJCF' },
		] as const

		expect(countExportNotes(notes)).toBe(3)
	})
})

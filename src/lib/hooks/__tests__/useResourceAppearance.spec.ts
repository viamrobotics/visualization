import { describe, expect, it } from 'vitest'

import { createSessionAppearance } from '$lib/hooks/useResourceAppearance.svelte'

describe('createSessionAppearance', () => {
	it('keeps one resource edits apart from another', () => {
		const session = createSessionAppearance()

		session.set('cage', { opacity: 0.2 })
		session.set('bounds-1', { color: '#ff0000' })

		expect(Object.fromEntries(session.current)).toEqual({
			cage: { opacity: 0.2 },
			'bounds-1': { color: '#ff0000' },
		})
	})

	it('drops a resource whose edits are left empty', () => {
		const session = createSessionAppearance()
		session.set('cage', { opacity: 0.2 })

		session.set('cage', {})

		expect(session.current.has('cage')).toBe(false)
	})

	it('drops every edit on clear', () => {
		const session = createSessionAppearance()
		session.set('cage', { opacity: 0.2 })

		session.clear()

		expect(session.current.size).toBe(0)
	})
})

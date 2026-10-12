import { describe, expect, it } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { resolvedAppearanceByComponent } from '$lib/resolvedAppearance'

const bounds: PartComponent = {
	name: 'bounds-1',
	visualizer: { type: 'bounds', color: '#ff0000', opacity: 0.5 },
}

const session = new Map([['bounds-1', { opacity: 0.2, frames: { floor: { color: '#00ff00' } } }]])

describe('resolvedAppearanceByComponent', () => {
	it('lays the session edits over the saved appearance outside build mode', () => {
		const resolved = resolvedAppearanceByComponent([bounds], session, 'monitor')

		expect(resolved.get('bounds-1')?.own).toEqual({ color: '#ff0000', opacity: 0.2 })
		expect(resolved.get('bounds-1')?.frames.get('floor')).toEqual({ color: '#00ff00' })
	})

	it('draws only the saved appearance in build mode, which edits it', () => {
		const resolved = resolvedAppearanceByComponent([bounds], session, 'build')

		expect(resolved.get('bounds-1')?.own).toEqual({ color: '#ff0000', opacity: 0.5 })
		expect(resolved.get('bounds-1')?.frames.size).toBe(0)
	})

	it('resolves a session edit on a frame no part component owns', () => {
		const resolved = resolvedAppearanceByComponent(
			[],
			new Map([['fragment-arm', { opacity: 0.3 }]]),
			'monitor'
		)

		expect(resolved.get('fragment-arm')?.own).toEqual({ opacity: 0.3 })
	})
})

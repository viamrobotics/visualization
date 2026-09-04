import { fireEvent, render, screen } from '@testing-library/svelte'
import { SvelteMap } from 'svelte/reactivity'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it } from 'vitest'

import type { useGizmos } from '../useGizmos.svelte'

import GizmoMenu from '../GizmoMenu.svelte'
import { GizmoModes } from '../gizmos'

describe('GizmoMenu', () => {
	// Accessors over a `SvelteMap`, not plain data properties, for two reasons. Svelte
	// proxies the props object, so a write to a data property lands on the proxy and never
	// reaches this object, while a write through a setter does. And the map is reactive, so
	// a change here actually re-renders. `state` is what the assertions read.
	let state: SvelteMap<string, unknown>
	let gizmos: ReturnType<typeof useGizmos>

	beforeEach(() => {
		state = new SvelteMap<string, unknown>([['mode', GizmoModes.Idle]])

		gizmos = Object.defineProperties(
			{},
			{
				mode: {
					get: () => state.get('mode'),
					set: (value: unknown) => {
						state.set('mode', value)
					},
					enumerable: true,
					configurable: true,
				},
			}
		) as ReturnType<typeof useGizmos>
	})

	const renderMenu = () => render(GizmoMenu, { props: { gizmos } })

	it('arms the coordinate-system tool', async () => {
		renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Coordinate system' }))

		expect(state.get('mode')).toBe(GizmoModes.CoordinateSystem)
	})

	it('does not arm a disabled entry', async () => {
		renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: /Reference plane/ }))

		expect(state.get('mode')).toBe(GizmoModes.Idle)
	})

	it('marks the unshipped tools as disabled and the shipped tool as enabled', () => {
		renderMenu()

		expect(screen.getByRole('button', { name: /Reference plane/ })).toBeDisabled()
		expect(screen.getByRole('button', { name: /Reference geometry/ })).toBeDisabled()
		expect(screen.getByRole('button', { name: /Polyline/ })).toBeDisabled()
		expect(screen.getByRole('button', { name: /Angle/ })).toBeDisabled()
		expect(screen.getByRole('button', { name: /Arrow/ })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Coordinate system' })).not.toBeDisabled()
	})
})

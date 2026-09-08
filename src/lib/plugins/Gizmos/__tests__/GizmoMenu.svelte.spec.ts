import { fireEvent, render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import type { provideGizmos } from '../useGizmos.svelte'

import { GizmoModes } from '../gizmos'
import GizmoMenuHost from './__fixtures__/GizmoMenuHost.svelte'

describe('GizmoMenu', () => {
	const renderMenu = () => {
		let gizmos!: ReturnType<typeof provideGizmos>

		render(GizmoMenuHost, {
			props: {
				onReady: (ready: ReturnType<typeof provideGizmos>) => {
					gizmos = ready
				},
			},
		})

		return gizmos
	}

	it('arms the coordinate-system tool', async () => {
		const gizmos = renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Coordinate system' }))

		expect(gizmos.mode).toBe(GizmoModes.CoordinateSystem)
	})

	it('does not arm a disabled entry', async () => {
		const gizmos = renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: /Reference plane/ }))

		expect(gizmos.mode).toBe(GizmoModes.Idle)
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

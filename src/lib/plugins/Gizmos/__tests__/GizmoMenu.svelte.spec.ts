import { fireEvent, render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import type { Settings } from '$lib/hooks/useSettings.svelte'

import type { provideGizmos } from '../useGizmos.svelte'

import { GizmoModes } from '../gizmos'
import GizmoMenuHost from './__fixtures__/GizmoMenuHost.svelte'

describe('GizmoMenu', () => {
	const renderMenu = () => {
		let ready!: { gizmos: ReturnType<typeof provideGizmos>; settings: Settings }

		render(GizmoMenuHost, {
			props: {
				onReady: (value: { gizmos: ReturnType<typeof provideGizmos>; settings: Settings }) => {
					ready = value
				},
			},
		})

		return ready
	}

	it('arms the coordinate-system tool', async () => {
		const { gizmos } = renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Coordinate system' }))

		expect(gizmos.mode).toBe(GizmoModes.CoordinateSystem)
	})

	it('arms the polyline tool', async () => {
		const { gizmos } = renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Polyline' }))

		expect(gizmos.mode).toBe(GizmoModes.Polyline)
	})

	it('arms the angle tool', async () => {
		const { gizmos } = renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Angle' }))

		expect(gizmos.mode).toBe(GizmoModes.Angle)
	})

	it('leaves no tool disabled', () => {
		renderMenu()

		for (const name of [
			'Coordinate system',
			'Reference plane',
			'Reference geometry',
			'Polyline',
			'Angle',
			'Arrow',
		]) {
			expect(screen.getByRole('button', { name }), name).not.toBeDisabled()
		}
	})

	it('reveals the geometry tool options, and not the plane tool options, once armed', async () => {
		renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Reference geometry' }))

		expect(screen.getByRole('radio', { name: 'box' })).toBeInTheDocument()
		expect(screen.queryByRole('radio', { name: 'yz' })).not.toBeInTheDocument()
	})

	it('writes the selected shape to the context when the shape toggle changes', async () => {
		const { gizmos } = renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Reference geometry' }))
		await fireEvent.click(screen.getByRole('radio', { name: 'sphere' }))

		expect(gizmos.referenceShape).toBe('sphere')
	})

	it('writes the wireframe toggle to the context', async () => {
		const { gizmos } = renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Reference geometry' }))
		await fireEvent.click(screen.getByRole('switch', { name: 'Wireframe' }))

		expect(gizmos.isWireframe).toBe(true)
	})

	it('reveals the polyline tool options, and not the geometry tool options, once armed', async () => {
		renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Polyline' }))

		expect(screen.getByRole('radio', { name: 'world' })).toBeInTheDocument()
		expect(screen.queryByRole('radio', { name: 'box' })).not.toBeInTheDocument()
	})

	it('writes the measurement toggle to the gizmos context', async () => {
		const { gizmos } = renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Polyline' }))
		await fireEvent.click(screen.getByRole('radio', { name: 'segment' }))

		expect(gizmos.lineMeasure).toBe('segment')
	})

	it('writes the snapping toggle to the settings prop', async () => {
		const { settings } = renderMenu()

		await fireEvent.click(screen.getByRole('button', { name: 'Polyline' }))
		await fireEvent.click(screen.getByRole('switch', { name: 'Snapping' }))

		expect(settings.snapping).toBe(true)
	})
})

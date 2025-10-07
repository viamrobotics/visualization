import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import Details from '../Details.svelte'
import * as useSelection from '$lib/hooks/useSelection.svelte'
import * as useWeblabs from '$lib/hooks/useWeblabs.svelte'
import { Weblab } from '$lib/hooks/useWeblabs.svelte'
import type { Geometry } from '@viamrobotics/sdk'

describe('Details component', () => {
	const mockedWeblab = new Weblab()

	beforeEach(() => {
		// Mock the selection hooks to return test data
		vi.mocked(useSelection.useFocusedObject).mockReturnValue({
			current: {
				name: 'Test Object',
				uuid: '1234-5678',
				referenceFrame: 'parent_frame',
				pose: {
					x: 10,
					y: 20,
					z: 30,
					oX: 0.1,
					oY: 0.2,
					oZ: 0.3,
					theta: 0.4,
				},
				geometry: {
					label: 'my geometry',
					geometryType: {
						case: 'box',
						value: {
							dimsMm: { x: 10, y: 20, z: 30 },
						},
					},
				} satisfies Geometry,
				metadata: {},
			},
		})
		vi.mocked(useSelection.useFocusedObject3d).mockReturnValue({
			current: undefined,
		})
		vi.mocked(useWeblabs.useWeblabs).mockReturnValue({
			weblab: mockedWeblab,
		})
	})

	it('renders object name', () => {
		render(Details)
		expect(screen.getByText('Test Object')).toBeInTheDocument()
	})

	it('renders local details under weblab active', () => {
		mockedWeblab.isActive = vi.fn(() => true)
		render(Details)

		expect(screen.getByText('parent frame')).toBeInTheDocument()
		const parentFrameNameSpan = screen.getByLabelText('parent frame name')
		const parentFrameNameText = parentFrameNameSpan.nextSibling as HTMLElement
		expect(parentFrameNameText.textContent?.trim()).toBe('parent_frame')

		expect(screen.getByText('local position')).toBeInTheDocument()

		const localPositionXSpan = screen.getByLabelText('local position x coordinate')
		const localPositionXText = localPositionXSpan.nextSibling as HTMLElement
		expect(localPositionXText.textContent?.trim()).toBe((10).toFixed(2))

		const localPositionYSpan = screen.getByLabelText('local position y coordinate')
		const localPositionYText = localPositionYSpan.nextSibling as HTMLElement
		expect(localPositionYText.textContent?.trim()).toBe((20).toFixed(2))

		const localPositionZSpan = screen.getByLabelText('local position z coordinate')
		const localPositionZText = localPositionZSpan.nextSibling as HTMLElement
		expect(localPositionZText.textContent?.trim()).toBe((30).toFixed(2))

		expect(screen.getByText('local orientation')).toBeInTheDocument()

		const localOrientationXSpan = screen.getByLabelText('local orientation x coordinate')
		const localOrientationXText = localOrientationXSpan.nextSibling as HTMLElement
		expect(localOrientationXText.textContent?.trim()).toBe((0.1).toFixed(2))

		const localOrientationYSpan = screen.getByLabelText('local orientation y coordinate')
		const localOrientationYText = localOrientationYSpan.nextSibling as HTMLElement
		expect(localOrientationYText.textContent?.trim()).toBe((0.2).toFixed(2))

		const localOrientationZSpan = screen.getByLabelText('local orientation z coordinate')
		const localOrientationZText = localOrientationZSpan.nextSibling as HTMLElement
		expect(localOrientationZText.textContent?.trim()).toBe((0.3).toFixed(2))

		const localOrientationThSpan = screen.getByLabelText('local orientation theta degrees')
		const localOrientationThText = localOrientationThSpan.nextSibling as HTMLElement
		expect(localOrientationThText.textContent?.trim()).toBe((0.4).toFixed(2))
	})
})

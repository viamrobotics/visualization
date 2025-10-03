import { getByTestId, render } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Details from '../Details.svelte'
import * as useSelection from '$lib/hooks/useSelection.svelte'
import * as useWeblabs from '$lib/hooks/useWeblabs.svelte'
import { Weblab } from '$lib/hooks/useWeblabs.svelte'

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
					case: 'box',
					value: {
						dimsMm: { x: 10, y: 20, z: 30 },
					},
				},
				metadata: { batched: undefined },
			},
		})
		vi.mocked(useSelection.useFocusedObject3d).mockReturnValue({
			current: undefined,
		})
		vi.mocked(useWeblabs.useWeblabs).mockReturnValue({
			weblab: mockedWeblab,
		})
	})

	function getDefaultProps(overrides = {}) {
		return {
			...overrides,
		}
	}

	it('renders object name', () => {
		const { getByText } = render(Details, getDefaultProps())
		expect(getByText('Test Object')).toBeDefined()
	})

	it('renders local details under weblab active', () => {
		mockedWeblab.isActive = vi.fn(() => true)
		const { getByText, getByTestId } = render(Details, getDefaultProps())

		expect(getByText('parent frame')).toBeDefined()
		const parentFrameNameSpan = getByTestId('parent-frame-name')
		expect(parentFrameNameSpan).toBeDefined()
		const parentFrameNameText = parentFrameNameSpan.nextSibling as HTMLElement
		expect(parentFrameNameText).toBeDefined()
		expect(parentFrameNameText.textContent?.trim()).toBe('parent_frame')

		expect(getByText('local position')).toBeDefined()

		const localPositionXSpan = getByTestId('local-position-x')
		expect(localPositionXSpan).toBeDefined()
		const localPositionXText = localPositionXSpan.nextSibling as HTMLElement
		expect(localPositionXText).toBeDefined()
		expect(localPositionXText.textContent?.trim()).toBe((10).toFixed(2))

		const localPositionYSpan = getByTestId('local-position-y')
		expect(localPositionYSpan).toBeDefined()
		const localPositionYText = localPositionYSpan.nextSibling as HTMLElement
		expect(localPositionYText).toBeDefined()
		expect(localPositionYText.textContent?.trim()).toBe((20).toFixed(2))

		const localPositionZSpan = getByTestId('local-position-z')
		expect(localPositionZSpan).toBeDefined()
		const localPositionZText = localPositionZSpan.nextSibling as HTMLElement
		expect(localPositionZText).toBeDefined()
		expect(localPositionZText.textContent?.trim()).toBe((30).toFixed(2))

		expect(getByText('local orientation')).toBeDefined()

		const localOrientationXSpan = getByTestId('local-orientation-x')
		expect(localOrientationXSpan).toBeDefined()
		const localOrientationXText = localOrientationXSpan.nextSibling as HTMLElement
		expect(localOrientationXText).toBeDefined()
		expect(localOrientationXText.textContent?.trim()).toBe((0.1).toFixed(2))

		const localOrientationYSpan = getByTestId('local-orientation-y')
		expect(localOrientationYSpan).toBeDefined()
		const localOrientationYText = localOrientationYSpan.nextSibling as HTMLElement
		expect(localOrientationYText).toBeDefined()
		expect(localOrientationYText.textContent?.trim()).toBe((0.2).toFixed(2))

		const localOrientationZSpan = getByTestId('local-orientation-z')
		expect(localOrientationZSpan).toBeDefined()
		const localOrientationZText = localOrientationZSpan.nextSibling as HTMLElement
		expect(localOrientationZText).toBeDefined()
		expect(localOrientationZText.textContent?.trim()).toBe((0.3).toFixed(2))

		const localOrientationThSpan = getByTestId('local-orientation-th')
		expect(localOrientationThSpan).toBeDefined()
		const localOrientationThText = localOrientationThSpan.nextSibling as HTMLElement
		expect(localOrientationThText).toBeDefined()
		expect(localOrientationThText.textContent?.trim()).toBe((0.4).toFixed(2))
	})
})

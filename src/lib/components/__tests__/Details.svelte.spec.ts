import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import Details from '../Details.svelte'
import * as useSelection from '$lib/hooks/useSelection.svelte'
import { createWeblabs, WEBLABS_CONTEXT_KEY } from '$lib/hooks/useWeblabs.svelte'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import { Struct, type Geometry } from '@viamrobotics/sdk'
import * as useFrames from '$lib/hooks/useFrames.svelte'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import type { WorldObject } from '$lib/WorldObject.svelte'

describe('Details component', () => {
	const mockedCurrent: WorldObject[] = []

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
				localEditedPose: {
					x: 10,
					y: 20,
					z: 30,
					oX: 0.1,
					oY: 0.2,
					oZ: 0.3,
					theta: 0.4,
				},
			},
		})
		vi.mocked(useSelection.useFocusedObject3d).mockReturnValue({
			current: undefined,
		})

		vi.mocked(useFrames.useFrames).mockReturnValue({
			current: mockedCurrent,
			fetching: false,
			getParentFrameOptions: vi.fn(),
		})
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue({
			localPartConfig: new Struct(),
			componentNameToFragmentId: {},
			updateFrame: vi.fn(),
			isDirty: false,
			saveLocalPartConfig: vi.fn(),
			resetLocalPartConfig: vi.fn(),
			deleteFrame: vi.fn(),
			createFrame: vi.fn(),
			hasEditPermissions: true,
		})
	})

	it('renders object name', () => {
		const context = createWeblabs()
		render(Details, { context: new Map([[WEBLABS_CONTEXT_KEY, context]]) })
		expect(screen.getByText('Test Object')).toBeInTheDocument()
	})

	it('renders local details under weblab active', () => {
		const weblabContext = createWeblabs()
		weblabContext.isActive = vi.fn(() => true)
		const environmentContext = createEnvironment()
		environmentContext.current.isStandalone = true
		const context = new Map<symbol, unknown>([
			[WEBLABS_CONTEXT_KEY, weblabContext],
			[ENVIRONMENT_CONTEXT_KEY, environmentContext],
		])

		render(Details, { context })
		expect(screen.getByText('parent frame')).toBeInTheDocument()
		const parentFrameNameSpan = screen.getByLabelText('immutable parent frame name')
		const parentFrameNameText = parentFrameNameSpan.nextSibling as HTMLElement
		expect(parentFrameNameText.textContent?.trim()).toBe('parent_frame')

		expect(screen.getByText('local position')).toBeInTheDocument()

		const localPositionXSpan = screen.getByLabelText('immutable local position x coordinate')
		const localPositionXText = localPositionXSpan.nextSibling as HTMLElement
		expect(localPositionXText.textContent?.trim()).toBe((10).toFixed(2))

		const localPositionYSpan = screen.getByLabelText('immutable local position y coordinate')
		const localPositionYText = localPositionYSpan.nextSibling as HTMLElement
		expect(localPositionYText.textContent?.trim()).toBe((20).toFixed(2))

		const localPositionZSpan = screen.getByLabelText('immutable local position z coordinate')
		const localPositionZText = localPositionZSpan.nextSibling as HTMLElement
		expect(localPositionZText.textContent?.trim()).toBe((30).toFixed(2))

		expect(screen.getByText('local orientation')).toBeInTheDocument()

		const localOrientationXSpan = screen.getByLabelText('immutable local orientation x coordinate')
		const localOrientationXText = localOrientationXSpan.nextSibling as HTMLElement
		expect(localOrientationXText.textContent?.trim()).toBe((0.1).toFixed(2))

		const localOrientationYSpan = screen.getByLabelText('immutable local orientation y coordinate')
		const localOrientationYText = localOrientationYSpan.nextSibling as HTMLElement
		expect(localOrientationYText.textContent?.trim()).toBe((0.2).toFixed(2))

		const localOrientationZSpan = screen.getByLabelText('immutable local orientation z coordinate')
		const localOrientationZText = localOrientationZSpan.nextSibling as HTMLElement
		expect(localOrientationZText.textContent?.trim()).toBe((0.3).toFixed(2))

		const localOrientationThSpan = screen.getByLabelText(
			'immutable local orientation theta degrees'
		)
		const localOrientationThText = localOrientationThSpan.nextSibling as HTMLElement
		expect(localOrientationThText.textContent?.trim()).toBe((0.4).toFixed(2))
	})

	it('renders update fields for frame nodes and weblab active', () => {
		const weblabContext = createWeblabs()
		weblabContext.isActive = vi.fn(() => true)
		const environmentContext = createEnvironment()
		environmentContext.current.isStandalone = true

		mockedCurrent.push({
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
			localEditedPose: {
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
			},
			metadata: {},
		})
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue({
			localPartConfig: new Struct().fromJson({
				components: [
					{
						name: 'Test Object',
						frame: {
							parent: 'parent_frame',
							translation: { x: 10, y: 20, z: 30 },
							geometry: {
								type: 'box',
								x: 10,
								y: 20,
								z: 30,
							},
						},
					},
				],
			}),
			componentNameToFragmentId: {},
			updateFrame: vi.fn(),
			isDirty: false,
			saveLocalPartConfig: vi.fn(),
			resetLocalPartConfig: vi.fn(),
			deleteFrame: vi.fn(),
			createFrame: vi.fn(),
			hasEditPermissions: true,
		})

		const context = new Map<symbol, unknown>([
			[WEBLABS_CONTEXT_KEY, weblabContext],
			[ENVIRONMENT_CONTEXT_KEY, environmentContext],
		])

		render(Details, { context })

		expect(screen.getByLabelText('mutable local position x coordinate')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable local position y coordinate')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable local position z coordinate')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable local orientation x coordinate')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable local orientation y coordinate')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable local orientation z coordinate')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable local orientation theta degrees')).toBeInTheDocument()
	})
})

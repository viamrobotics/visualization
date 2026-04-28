import { render, screen } from '@testing-library/svelte'
import { createWorld, type Entity } from 'koota'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import * as useConfigFrames from '$lib/hooks/useConfigFrames.svelte'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import * as useLinkedEntities from '$lib/hooks/useLinked.svelte'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import * as useResourceByName from '$lib/hooks/useResourceByName.svelte'
import * as useSelection from '$lib/hooks/useSelection.svelte'
import { createWeblabs, WEBLABS_CONTEXT_KEY } from '$lib/hooks/useWeblabs.svelte'

import Details from '../Details.svelte'
import { createEntityFixture } from './__fixtures__/entity'
import { resource } from './__fixtures__/resource'

describe('Details component', () => {
	const world = createWorld()

	let entity: Entity

	beforeEach(() => {
		// Mock the selection hooks to return test data
		world.reset()

		entity = createEntityFixture(world)

		vi.mocked(useSelection.useFocusedEntity).mockReturnValue({
			current: entity,
			instance: undefined,
			set: () => {},
		})

		vi.mocked(useSelection.useFocusedObject3d).mockReturnValue({
			current: undefined,
		})
		vi.mocked(useResourceByName.useResourceByName).mockReturnValue({
			current: {},
		})
		vi.mocked(useConfigFrames.useConfigFrames).mockReturnValue({
			getParentFrameOptions: vi.fn(),
			unsetFrames: [],
			current: {},
		})
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue({
			current: { components: [] },
			componentNameToFragmentId: {},
			updateFrame: vi.fn(),
			isDirty: false,
			hasPendingSave: false,
			clearPendingSave: vi.fn(),
			setPendingSave: vi.fn(),
			save: vi.fn(),
			discardChanges: vi.fn(),
			deleteFrame: vi.fn(),
			createFrame: vi.fn(),
			hasEditPermissions: true,
		})
		vi.mocked(useLinkedEntities.useLinkedEntities).mockReturnValue({
			current: [],
		})
	})

	it('renders object name', () => {
		const context = createWeblabs()
		render(Details, {
			context: new Map<symbol, unknown>([
				[WEBLABS_CONTEXT_KEY, context],
				[WORLD_CONTEXT_KEY, world],
			]),
		})
		expect(screen.getByText('Test Object')).toBeInTheDocument()
	})

	it('renders local details', () => {
		const weblabContext = createWeblabs()
		weblabContext.isActive = vi.fn(() => true)
		const environmentContext = createEnvironment()
		environmentContext.current.isStandalone = true
		const context = new Map<symbol, unknown>([
			[WEBLABS_CONTEXT_KEY, weblabContext],
			[ENVIRONMENT_CONTEXT_KEY, environmentContext],
			[WORLD_CONTEXT_KEY, world],
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

	it('renders update fields for frame nodes', () => {
		const weblabContext = createWeblabs()
		weblabContext.isActive = vi.fn(() => true)
		const environmentContext = createEnvironment()
		environmentContext.current.isStandalone = true

		entity.add(traits.FramesAPI)

		vi.mocked(usePartConfig.usePartConfig).mockReturnValue({
			current: {
				components: [resource],
			},
			componentNameToFragmentId: {},
			updateFrame: vi.fn(),
			isDirty: false,
			hasPendingSave: false,
			clearPendingSave: vi.fn(),
			setPendingSave: vi.fn(),
			save: vi.fn(),
			discardChanges: vi.fn(),
			deleteFrame: vi.fn(),
			createFrame: vi.fn(),
			hasEditPermissions: true,
		})

		const context = new Map<symbol, unknown>([
			[WEBLABS_CONTEXT_KEY, weblabContext],
			[ENVIRONMENT_CONTEXT_KEY, environmentContext],
			[WORLD_CONTEXT_KEY, world],
		])

		render(Details, { context })

		const positionGroup = screen.getByLabelText('mutable local position')
		expect(positionGroup).toBeInTheDocument()
		expect(positionGroup.querySelectorAll('input')).toHaveLength(3)

		const orientationGroup = screen.getByLabelText('mutable local orientation')
		expect(orientationGroup).toBeInTheDocument()
		// 4 OV inputs (x, y, z, theta) plus 3 Euler inputs (x, y, z) — both
		// TabPages are mounted simultaneously by tweakpane's TabGroup.
		expect(orientationGroup.querySelectorAll('input')).toHaveLength(7)
	})
})

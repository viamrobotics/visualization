import { fireEvent, render, screen } from '@testing-library/svelte'
import { createWorld, type Entity } from 'koota'
import { on } from 'svelte/events'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEntityFixture } from '$lib/__tests__/__fixtures__/entity'
import { resource } from '$lib/__tests__/__fixtures__/resource'
import WithWorld from '$lib/__tests__/__fixtures__/WithWorld.svelte'
import { traits } from '$lib/ecs'
import * as useConfigFrames from '$lib/hooks/useConfigFrames.svelte'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import * as useFragmentInfo from '$lib/hooks/useFragmentInfo.svelte'
import * as useLinkedEntities from '$lib/hooks/useLinked.svelte'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import * as useResourceByName from '$lib/hooks/useResourceByName.svelte'
import { createWeblabs, WEBLABS_CONTEXT_KEY } from '$lib/hooks/useWeblabs.svelte'

import BuildDetails from '../BuildDetails.svelte'

describe('BuildDetails', () => {
	const world = createWorld()

	let entity: Entity

	beforeEach(() => {
		world.reset()

		entity = createEntityFixture(world)
		entity.add(traits.FramesAPI)
		entity.add(traits.Editable)

		vi.mocked(useResourceByName.useResourceByName).mockReturnValue({
			current: {},
		})
		vi.mocked(useFragmentInfo.useFragmentInfo).mockReturnValue({
			current: {},
		})
		vi.mocked(useConfigFrames.useConfigFrames).mockReturnValue({
			unsetFrames: [],
			unresolvedFrames: new Set(),
			current: {},
			fragmentFrames: {},
			effectiveFrames: new Map(),
		})
		vi.mocked(useLinkedEntities.useLinkedEntities).mockReturnValue({
			current: [],
		})
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue({
			current: {
				components: [resource],
			},
			isReady: true,
			updateFrame: vi.fn(),
			isDirty: false,
			save: vi.fn(),
			discardChanges: vi.fn(),
			deleteFrame: vi.fn(),
			createFrame: vi.fn(),
			createComponent: vi.fn(),
			hasEditPermissions: true,
			canUndoFrameEdit: false,
			canRedoFrameEdit: false,
			undoFrameEdit: vi.fn(),
			redoFrameEdit: vi.fn(),
			beginFrameEditHistoryEntry: vi.fn(),
			endFrameEditHistoryEntry: vi.fn(),
		})
	})

	const renderPanel = () => {
		const weblabContext = createWeblabs()
		weblabContext.isActive = vi.fn(() => true)
		const environmentContext = createEnvironment()
		environmentContext.current.isStandalone = true

		return render(WithWorld, {
			props: { world, component: BuildDetails, props: { entity } },
			context: new Map<symbol, unknown>([
				[WEBLABS_CONTEXT_KEY, weblabContext],
				[ENVIRONMENT_CONTEXT_KEY, environmentContext],
			]),
		})
	}

	it('renders update fields for frame nodes', () => {
		renderPanel()

		const positionGroup = screen.getByLabelText('mutable local position')
		expect(positionGroup).toBeInTheDocument()
		expect(positionGroup.querySelectorAll('input')).toHaveLength(3)

		const orientationGroup = screen.getByLabelText('mutable local orientation')
		expect(orientationGroup).toBeInTheDocument()
		// 4 OV inputs (x, y, z, theta) plus 3 Euler inputs (x, y, z) — both
		// TabPages are mounted simultaneously by tweakpane's TabGroup.
		expect(orientationGroup.querySelectorAll('input')).toHaveLength(7)
	})

	it('stops keyboard events from propagating out of the panel', async () => {
		const { container } = renderPanel()

		// Svelte 5 delegates keydown and keyup. Using `on` from svelte/events puts this listener in the same propagation chain as onkeydown.
		const parentListener = vi.fn()
		const stopKeydown = on(container, 'keydown', parentListener)
		const stopKeyup = on(container, 'keyup', parentListener)

		const panel = screen.getByRole('region', { name: 'Details panel' })
		const positionGroup = screen.getByLabelText('mutable local position')
		const input = positionGroup.querySelector('input')

		expect(input).not.toBeNull()
		expect(panel.contains(input)).toBe(true)

		input!.focus()
		expect(document.activeElement).toBe(input)

		await fireEvent.keyDown(input!, { key: 'ArrowDown', bubbles: true })
		await fireEvent.keyUp(input!, { key: 'ArrowDown', bubbles: true })

		expect(parentListener).not.toHaveBeenCalled()

		stopKeydown()
		stopKeyup()
	})
})

import { render, screen } from '@testing-library/svelte'
import { createWorld, type Entity } from 'koota'
import { createRawSnippet } from 'svelte'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DetailsSection } from '$lib/hooks/useDetailsSections.svelte'

import { createEntityFixture } from '$lib/__tests__/__fixtures__/entity'
import WithWorld from '$lib/__tests__/__fixtures__/WithWorld.svelte'
import * as useConfigFrames from '$lib/hooks/useConfigFrames.svelte'
import {
	createDetailsSections,
	DETAILS_SECTIONS_CONTEXT_KEY,
} from '$lib/hooks/useDetailsSections.svelte'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import * as useFragmentInfo from '$lib/hooks/useFragmentInfo.svelte'
import * as useLinkedEntities from '$lib/hooks/useLinked.svelte'
import * as useResourceByName from '$lib/hooks/useResourceByName.svelte'
import { createWeblabs, WEBLABS_CONTEXT_KEY } from '$lib/hooks/useWeblabs.svelte'

import MonitorDetails from '../MonitorDetails.svelte'

describe('MonitorDetails', () => {
	const world = createWorld()

	let entity: Entity

	beforeEach(() => {
		world.reset()

		entity = createEntityFixture(world)

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
	})

	const renderPanel = (sections = createDetailsSections()) => {
		const weblabContext = createWeblabs()
		weblabContext.isActive = vi.fn(() => true)

		render(WithWorld, {
			props: { world, component: MonitorDetails, props: { entity } },
			context: new Map<symbol, unknown>([
				[WEBLABS_CONTEXT_KEY, weblabContext],
				[ENVIRONMENT_CONTEXT_KEY, createEnvironment()],
				[DETAILS_SECTIONS_CONTEXT_KEY, sections],
			]),
		})
	}

	it('renders the object name', () => {
		renderPanel()
		expect(screen.getByText('Test Object')).toBeInTheDocument()
	})

	it('renders contributed details sections gated by when()', () => {
		const sections = createDetailsSections()
		const sectionFor = (text: string) =>
			createRawSnippet<[{ entity: Entity }]>(() => ({
				render: () => `<p>${text}</p>`,
			})) as DetailsSection['snippet']

		sections.register({ snippet: sectionFor('shown section') })
		sections.register({ snippet: sectionFor('hidden section'), when: () => false })

		renderPanel(sections)

		expect(screen.getByText('shown section')).toBeInTheDocument()
		expect(screen.queryByText('hidden section')).not.toBeInTheDocument()
	})

	it('renders read-only local details', () => {
		renderPanel()

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
		expect(localOrientationXText.textContent?.trim()).toBe((0.6).toFixed(2))

		const localOrientationYSpan = screen.getByLabelText('immutable local orientation y coordinate')
		const localOrientationYText = localOrientationYSpan.nextSibling as HTMLElement
		expect(localOrientationYText.textContent?.trim()).toBe((0.8).toFixed(2))

		const localOrientationZSpan = screen.getByLabelText('immutable local orientation z coordinate')
		const localOrientationZText = localOrientationZSpan.nextSibling as HTMLElement
		expect(localOrientationZText.textContent?.trim()).toBe((0).toFixed(2))

		const localOrientationThSpan = screen.getByLabelText(
			'immutable local orientation theta degrees'
		)
		const localOrientationThText = localOrientationThSpan.nextSibling as HTMLElement
		expect(localOrientationThText.textContent?.trim()).toBe((0.4).toFixed(2))
	})
})

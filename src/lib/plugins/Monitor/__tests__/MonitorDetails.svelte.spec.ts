import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld, type Entity } from 'koota'
import { createRawSnippet } from 'svelte'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEntityFixture } from '#lib/__tests__/__fixtures__/entity.js'
import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'
import * as useConfigFrames from '#lib/hooks/useConfigFrames.svelte.js'
import {
	createDetailsSections,
	DETAILS_SECTIONS_CONTEXT_KEY,
} from '#lib/hooks/useDetailsSections.svelte.js'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '#lib/hooks/useEnvironment.svelte.js'
import * as useFragmentInfo from '#lib/hooks/useFragmentInfo.svelte.js'
import * as useLinkedEntities from '#lib/hooks/useLinked.svelte.js'
import {
	RESOURCE_APPEARANCE_CONTEXT_KEY,
	type ResourceAppearanceContext,
} from '#lib/hooks/useResourceAppearance.svelte.js'
import * as useResourceByName from '#lib/hooks/useResourceByName.svelte.js'
import { createWeblabs, WEBLABS_CONTEXT_KEY } from '#lib/hooks/useWeblabs.svelte.js'

import MonitorDetails from '../MonitorDetails.svelte'

vi.mock('@viamrobotics/prime-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@viamrobotics/prime-core')>()),
	useToast: () => vi.fn(),
}))

describe('MonitorDetails', () => {
	const world = createWorld()

	let entity: Entity

	beforeEach(() => {
		world.reset()
		localStorage.removeItem('details-active-tab')

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
			obstacleFrames: {},
		})
		vi.mocked(useLinkedEntities.useLinkedEntities).mockReturnValue({
			current: [],
		})
	})

	const renderPanel = (sections = createDetailsSections(), entities = [entity]) => {
		const weblabContext = createWeblabs()
		weblabContext.isActive = vi.fn(() => true)

		const resourceAppearance: ResourceAppearanceContext = {
			current: new Map(),
			session: new Map(),
			setSession: vi.fn(),
		}

		render(MonitorDetails, {
			props: { entities },
			context: new Map<symbol, unknown>([
				[WEBLABS_CONTEXT_KEY, weblabContext],
				[ENVIRONMENT_CONTEXT_KEY, createEnvironment()],
				[WORLD_CONTEXT_KEY, world],
				[DETAILS_SECTIONS_CONTEXT_KEY, sections],
				[RESOURCE_APPEARANCE_CONTEXT_KEY, resourceAppearance],
			]),
		})
	}

	it('renders the object name', () => {
		renderPanel()
		expect(screen.getByText('Test Object')).toBeInTheDocument()
	})

	const sectionFor = (text: string) =>
		createRawSnippet<[{ entities: readonly Entity[] }]>(() => ({
			render: () => `<p>${text}</p>`,
		}))

	it('renders contributed details sections gated by when()', () => {
		const sections = createDetailsSections()
		sections.register({ snippet: sectionFor('shown section'), label: 'shown' })
		sections.register({ snippet: sectionFor('hidden section'), label: 'hidden', when: () => false })

		renderPanel(sections)

		expect(screen.getByText('shown section')).toBeInTheDocument()
		expect(screen.queryByText('hidden section')).not.toBeInTheDocument()
	})

	it('names a section in a notice, in place of its content, when when() holds for only part of the selection', () => {
		const other = world.spawn(traits.Name('Other Object'))
		const sections = createDetailsSections()
		sections.register({
			snippet: sectionFor('battery rows'),
			label: 'battery',
			when: (candidate) => candidate === entity,
		})

		renderPanel(sections, [entity, other])

		expect(screen.queryByText('battery rows')).not.toBeInTheDocument()
		expect(screen.getByRole('note')).toHaveTextContent('battery')
	})

	it('titles a selection of several objects by its count', () => {
		renderPanel(undefined, [entity, world.spawn(traits.Name('Other Object'))])

		expect(screen.getByText('2 selected')).toBeInTheDocument()
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

	describe('appearance tab', () => {
		const openAppearance = async () => {
			renderPanel()
			await userEvent.click(screen.getByRole('tab', { name: 'Appearance' }))
		}

		it('holds a frame edit for the session, so it reaches the frames inside', async () => {
			entity.add(traits.FramesAPI)

			await openAppearance()

			expect(screen.getByText(/Not saved, and a reload drops these changes/)).toBeInTheDocument()
		})

		it('edits anything other than a frame on the entity itself', async () => {
			await openAppearance()

			expect(screen.queryByText(/Not saved/)).not.toBeInTheDocument()
			expect(screen.getByLabelText('mutable opacity')).toBeInTheDocument()
		})
	})
})

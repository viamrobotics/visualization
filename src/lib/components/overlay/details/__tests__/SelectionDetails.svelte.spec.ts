import type { ComponentProps } from 'svelte'

import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld, type Entity } from 'koota'
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

import SelectionDetailsHost from './__fixtures__/SelectionDetailsHost.svelte'

type Sections = ComponentProps<typeof SelectionDetailsHost>['sections']

vi.mock('@viamrobotics/prime-ui', async (importOriginal) => ({
	...(await importOriginal<typeof import('@viamrobotics/prime-ui')>()),
	useToast: () => ({ info: vi.fn(), success: vi.fn(), warning: vi.fn(), danger: vi.fn() }),
}))

describe('SelectionDetails', () => {
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

	const renderPanel = (sections: Sections = [], entities = [entity]) => {
		const weblabContext = createWeblabs()
		weblabContext.isActive = vi.fn(() => true)

		const resourceAppearance: ResourceAppearanceContext = {
			current: new Map(),
			session: new Map(),
			setSession: vi.fn(),
		}

		render(SelectionDetailsHost, {
			props: { entities, sections },
			context: new Map<symbol, unknown>([
				[WEBLABS_CONTEXT_KEY, weblabContext],
				[ENVIRONMENT_CONTEXT_KEY, createEnvironment()],
				[WORLD_CONTEXT_KEY, world],
				[DETAILS_SECTIONS_CONTEXT_KEY, createDetailsSections()],
				[RESOURCE_APPEARANCE_CONTEXT_KEY, resourceAppearance],
			]),
		})
	}

	it('renders the object name', () => {
		renderPanel()
		expect(screen.getByText('Test Object')).toBeInTheDocument()
	})

	it('renders contributed details sections gated by when()', () => {
		renderPanel([
			{ text: 'shown section', label: 'shown' },
			{ text: 'hidden section', label: 'hidden', when: () => false },
		])

		expect(screen.getByText('shown section')).toBeInTheDocument()
		expect(screen.queryByText('hidden section')).not.toBeInTheDocument()
	})

	it('names a section in a notice, in place of its content, when when() holds for only part of the selection', () => {
		const other = world.spawn(traits.Name('Other Object'))

		renderPanel(
			[{ text: 'battery rows', label: 'battery', when: (candidate) => candidate === entity }],
			[entity, other]
		)

		expect(screen.queryByText('battery rows')).not.toBeInTheDocument()
		expect(screen.getByRole('note', { name: 'battery' })).toHaveTextContent(
			'Not every selected object supports this.'
		)
	})

	it('offers no Test tab while no test section applies to the selection', () => {
		renderPanel([{ text: 'arm controls', label: 'test', tab: 'test', when: () => false }])

		expect(screen.queryByRole('tab', { name: 'Test' })).not.toBeInTheDocument()
	})

	it('renders the registered test section in the Test tab', async () => {
		renderPanel([{ text: 'arm controls', label: 'test', tab: 'test' }])
		await userEvent.click(screen.getByRole('tab', { name: 'Test' }))

		expect(screen.getByText('arm controls')).toBeInTheDocument()
	})

	it('titles a selection of several objects by its count', () => {
		renderPanel([], [entity, world.spawn(traits.Name('Other Object'))])

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
		const openAppearance = async (sections: Sections = []) => {
			renderPanel(sections)
			await userEvent.click(screen.getByRole('tab', { name: 'Appearance' }))
		}

		it('edits an object no section takes over on the entity itself', async () => {
			await openAppearance()

			expect(screen.getByRole('slider', { name: 'opacity' })).toBeInTheDocument()
		})

		it('leaves its own controls out for an object a section takes over', async () => {
			await openAppearance([
				{
					text: 'session appearance',
					label: 'appearance',
					tab: 'appearance',
					replacesAppearance: true,
				},
			])

			expect(screen.getByText('session appearance')).toBeInTheDocument()
			expect(screen.queryByRole('slider', { name: 'opacity' })).not.toBeInTheDocument()
		})

		it('asks for one kind of object when a section takes over only part of the selection', async () => {
			const other = world.spawn(traits.Name('Other Object'))
			renderPanel(
				[
					{
						text: 'session appearance',
						label: 'appearance',
						tab: 'appearance',
						replacesAppearance: true,
						when: (candidate) => candidate === entity,
					},
				],
				[entity, other]
			)

			await userEvent.click(screen.getByRole('tab', { name: 'Appearance' }))

			expect(screen.getByRole('note', { name: 'appearance' })).toHaveTextContent(
				'Some selected objects keep their appearance differently. Select only one kind to edit it.'
			)
		})
	})
})

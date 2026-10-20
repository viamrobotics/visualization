import { fireEvent, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld, type Entity } from 'koota'
import { on } from 'svelte/events'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEntityFixture } from '$lib/__tests__/__fixtures__/entity'
import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { resource } from '$lib/__tests__/__fixtures__/resource'
import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import * as useConfigFrames from '$lib/hooks/useConfigFrames.svelte'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import * as useFragmentInfo from '$lib/hooks/useFragmentInfo.svelte'
import * as useLinkedEntities from '$lib/hooks/useLinked.svelte'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import * as useResourceByName from '$lib/hooks/useResourceByName.svelte'
import { createWeblabs, WEBLABS_CONTEXT_KEY } from '$lib/hooks/useWeblabs.svelte'
import { createComplexObstacleComponent, createObstacleComponent } from '$lib/obstacle'

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
			obstacleFrames: {},
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
			updateComponent: vi.fn(),
			hasEditPermissions: true,
			canUndoFrameEdit: false,
			canRedoFrameEdit: false,
			undoFrameEdit: vi.fn(),
			redoFrameEdit: vi.fn(),
			beginFrameEditHistoryEntry: vi.fn(),
			endFrameEditHistoryEntry: vi.fn(),
		})
	})

	const renderPanel = ({ isStandalone = true } = {}) => {
		const weblabContext = createWeblabs()
		weblabContext.isActive = vi.fn(() => true)
		const environmentContext = createEnvironment()
		environmentContext.current.isStandalone = isStandalone

		return render(BuildDetails, {
			props: { entity },
			context: new Map<symbol, unknown>([
				[WEBLABS_CONTEXT_KEY, weblabContext],
				[ENVIRONMENT_CONTEXT_KEY, environmentContext],
				[WORLD_CONTEXT_KEY, world],
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

	const useComponentModel = (model: string) => {
		const current = vi.mocked(usePartConfig.usePartConfig)()
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue({
			...current,
			current: { components: [{ ...resource, model }] },
		})
	}

	it('keeps the geometry editor for a non-obstacle component', () => {
		useComponentModel('rdk:builtin:fake')

		renderPanel()

		expect(screen.getByLabelText('mutable geometry')).toBeInTheDocument()
	})

	const useSimpleObstacle = () => {
		const obstacle = { ...createObstacleComponent(resource.name), frame: resource.frame }
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue(
			createPartConfigFixture({ current: { components: [obstacle] } })
		)
	}

	it('keeps Delete frame and its Actions heading for a frame', () => {
		useComponentModel('rdk:builtin:fake')

		renderPanel()

		expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Delete frame' })).toBeInTheDocument()
	})

	it('renders no Actions heading when there is no action', () => {
		useComponentModel('rdk:builtin:fake')

		renderPanel({ isStandalone: false })

		expect(screen.queryByRole('button', { name: 'Delete frame' })).not.toBeInTheDocument()
		expect(screen.queryByRole('heading', { name: 'Actions' })).not.toBeInTheDocument()
	})

	it('offers no Delete frame, and so no Actions heading, for an obstacle', () => {
		useSimpleObstacle()

		renderPanel()

		expect(screen.queryByRole('button', { name: 'Delete frame' })).not.toBeInTheDocument()
		expect(screen.queryByRole('heading', { name: 'Actions' })).not.toBeInTheDocument()
	})

	it('shows an obstacle section, open by default, in place of the frame geometry editor', () => {
		useSimpleObstacle()

		renderPanel()

		const trigger = screen.getByRole('button', { name: 'obstacle' })
		expect(trigger).toHaveAttribute('aria-expanded', 'true')
		expect(screen.getByLabelText('obstacle shape')).toBeVisible()
		expect(screen.queryByRole('tab', { name: 'Obstacle' })).not.toBeInTheDocument()
	})

	it('keeps the frame geometry editor, with no obstacle section, for a frame', () => {
		useComponentModel('rdk:builtin:fake')

		renderPanel()

		expect(screen.getByLabelText('mutable geometry')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'obstacle' })).not.toBeInTheDocument()
		expect(screen.queryByLabelText('obstacle shape')).not.toBeInTheDocument()
	})

	it('shows the obstacle editor instead of the frame geometry editor for a simple obstacle', () => {
		useSimpleObstacle()

		renderPanel()

		const obstacleShape = screen.getByLabelText('obstacle shape')
		const geometryEditors = screen.getAllByLabelText('mutable geometry')
		expect(geometryEditors).toHaveLength(1)
		expect(obstacleShape.contains(geometryEditors[0]!)).toBe(true)
		expect(screen.getByLabelText('mutable local position')).toBeInTheDocument()
	})

	it('shows the geometry list editor for an obstacle without a hint', () => {
		const labels = ['x_max', 'y_max', 'y_min', 'ceiling']
		const obstacle: usePartConfig.PartComponent = {
			...createObstacleComponent(resource.name),
			frame: resource.frame,
			visualizer: undefined,
			attributes: {
				geometries: labels.map((label, index) => ({
					label,
					type: 'box' as const,
					x: 10,
					y: 10,
					z: 10,
					translation: { x: index * 100, y: 0, z: 0 },
				})),
			},
		}
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue(
			createPartConfigFixture({ current: { components: [obstacle] } })
		)

		renderPanel()

		const group = screen.getByLabelText('obstacle geometries')
		for (const label of labels) {
			expect(within(group).getByRole('button', { name: `Select ${label}` })).toBeInTheDocument()
		}
		expect(screen.queryByLabelText('obstacle shape')).not.toBeInTheDocument()
		expect(screen.getAllByLabelText('mutable local position')).toHaveLength(1)
	})

	describe('for a selected Complex obstacle shape', () => {
		const useComplexObstacle = ({ hasEditPermissions = true } = {}) => {
			const cage: usePartConfig.PartComponent = {
				...createComplexObstacleComponent('cage'),
				attributes: {
					geometries: [
						{ label: 'a', type: 'box', x: 10, y: 10, z: 10 },
						{ label: 'b', type: 'sphere', r: 5 },
					],
				},
			}
			vi.mocked(usePartConfig.usePartConfig).mockReturnValue(
				createPartConfigFixture({ current: { components: [cage] }, hasEditPermissions })
			)
			entity = world.spawn(
				traits.Name('cage:b'),
				traits.FramesAPI,
				traits.ComplexObstacleShape({ index: 1 })
			)
		}

		it('edits the shape in place of the frame pose and geometry', () => {
			useComplexObstacle()

			renderPanel()

			expect(screen.getByLabelText('label')).toHaveValue('b')
			expect(screen.getAllByLabelText('mutable local position')).toHaveLength(1)
			expect(screen.getByLabelText('mutable sphere dimensions')).toBeInTheDocument()
			expect(screen.queryByLabelText('mutable parent frame')).not.toBeInTheDocument()
		})

		it('offers Remove shape as its action', () => {
			useComplexObstacle()

			renderPanel()

			expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument()
			expect(screen.getByRole('button', { name: 'Remove shape' })).toBeInTheDocument()
		})

		it('stays read-only without permission to edit the config', () => {
			useComplexObstacle({ hasEditPermissions: false })

			renderPanel()

			expect(screen.queryByLabelText('label')).not.toBeInTheDocument()
			expect(screen.queryByRole('button', { name: 'Remove shape' })).not.toBeInTheDocument()
		})
	})

	describe('appearance tab', () => {
		const openAppearance = async () => {
			renderPanel()
			await userEvent.click(screen.getByRole('tab', { name: 'Appearance' }))
		}

		it('saves the appearance of a part-owned resource to its config', async () => {
			await openAppearance()

			expect(screen.getByText("Saved to this resource's config.")).toBeInTheDocument()
		})

		it('edits only the scene for a frame no part component owns', async () => {
			entity = world.spawn(traits.Name('drawn-box'), traits.FramesAPI, traits.Editable)

			await openAppearance()

			expect(screen.queryByText("Saved to this resource's config.")).not.toBeInTheDocument()
			expect(screen.getByLabelText('mutable opacity')).toBeInTheDocument()
		})

		it('edits only the scene without permission to edit the config', async () => {
			vi.mocked(usePartConfig.usePartConfig).mockReturnValue(
				createPartConfigFixture({
					current: { components: [resource] },
					hasEditPermissions: false,
				})
			)

			await openAppearance()

			expect(screen.queryByText("Saved to this resource's config.")).not.toBeInTheDocument()
		})
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

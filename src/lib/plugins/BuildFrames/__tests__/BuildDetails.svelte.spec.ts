import { fireEvent, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld, type Entity } from 'koota'
import { on } from 'svelte/events'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEntityFixture } from '#lib/__tests__/__fixtures__/entity.js'
import { createPartConfigFixture } from '#lib/__tests__/__fixtures__/partConfig.js'
import { resource } from '#lib/__tests__/__fixtures__/resource.js'
import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'
import * as useConfigFrames from '#lib/hooks/useConfigFrames.svelte.js'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '#lib/hooks/useEnvironment.svelte.js'
import * as useFragmentInfo from '#lib/hooks/useFragmentInfo.svelte.js'
import * as useLinkedEntities from '#lib/hooks/useLinked.svelte.js'
import * as usePartConfig from '#lib/hooks/usePartConfig.svelte.js'
import * as useResourceByName from '#lib/hooks/useResourceByName.svelte.js'
import { createWeblabs, WEBLABS_CONTEXT_KEY } from '#lib/hooks/useWeblabs.svelte.js'
import { createKeybindings, KEYBINDINGS_CONTEXT_KEY } from '#lib/keybindings/index.js'
import { createComplexObstacleComponent, createObstacleComponent } from '#lib/obstacle.js'

import BuildDetails from '../BuildDetails.svelte'

vi.mock('@viamrobotics/prime-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@viamrobotics/prime-core')>()),
	useToast: () => vi.fn(),
}))

vi.mock('../obstaclePreviewToggle.svelte', () => ({
	useObstaclePreviewToggle: () => ({ isEnabled: false, unavailableReason: () => undefined }),
}))

describe('BuildDetails', () => {
	const world = createWorld()

	let entity: Entity

	beforeEach(() => {
		world.reset()
		localStorage.removeItem('details-active-tab')

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
			deleteFrames: vi.fn(),
			createFrame: vi.fn(),
			createComponent: vi.fn(),
			createComponents: vi.fn(),
			updateComponent: vi.fn(),
			updateComponents: vi.fn(),
			deleteComponent: vi.fn(),
			deleteComponents: vi.fn(),
			hasEditPermissions: true,
			hasConfigSource: true,
			canSave: true,
			canUndoFrameEdit: false,
			canRedoFrameEdit: false,
			undoFrameEdit: vi.fn(),
			redoFrameEdit: vi.fn(),
			beginFrameEditHistoryEntry: vi.fn(),
			endFrameEditHistoryEntry: vi.fn(),
		})
	})

	let keybindings = createKeybindings()

	const renderPanel = ({ isStandalone = true, entities = [entity] } = {}) => {
		const weblabContext = createWeblabs()
		weblabContext.isActive = vi.fn(() => true)
		const environmentContext = createEnvironment()
		environmentContext.current.isStandalone = isStandalone
		keybindings = createKeybindings()

		return render(BuildDetails, {
			props: { entities },
			context: new Map<symbol, unknown>([
				[WEBLABS_CONTEXT_KEY, weblabContext],
				[ENVIRONMENT_CONTEXT_KEY, environmentContext],
				[WORLD_CONTEXT_KEY, world],
				[KEYBINDINGS_CONTEXT_KEY, keybindings],
			]),
		})
	}

	const pressShiftD = () => {
		for (const { handler } of keybindings.matching({ key: 'D', shift: true, mod: false })) {
			handler.run()
		}
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

	const useSimpleObstacle = (otherComponents: usePartConfig.PartComponent[] = []) => {
		const obstacle = { ...createObstacleComponent(resource.name), frame: resource.frame }
		const createComponents = vi.fn()
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue(
			createPartConfigFixture({
				current: { components: [obstacle, ...otherComponents] },
				createComponents,
			})
		)
		return createComponents
	}

	it('keeps Delete frame and its Actions heading for a frame', () => {
		useComponentModel('rdk:builtin:fake')

		renderPanel()

		expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Delete frame' })).toBeInTheDocument()
	})

	it('offers Delete frame when embedded, not only in the standalone app', () => {
		useComponentModel('rdk:builtin:fake')

		renderPanel({ isStandalone: false })

		expect(screen.getByRole('button', { name: 'Delete frame' })).toBeInTheDocument()
	})

	it('renders no Actions heading when there is no action', () => {
		useComponentModel('rdk:builtin:fake')
		entity.remove(traits.Editable)

		renderPanel()

		expect(screen.queryByRole('button', { name: 'Delete frame' })).not.toBeInTheDocument()
		expect(screen.queryByRole('heading', { name: 'Actions' })).not.toBeInTheDocument()
	})

	it('offers Delete obstacle, not Delete frame, for an obstacle', () => {
		useSimpleObstacle()

		renderPanel()

		expect(screen.queryByRole('button', { name: 'Delete frame' })).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Delete obstacle' })).toBeInTheDocument()
	})

	it('deletes the whole obstacle component when Delete obstacle is pressed', async () => {
		useSimpleObstacle()
		const { deleteComponents } = vi.mocked(usePartConfig.usePartConfig)()
		renderPanel()

		await userEvent.click(screen.getByRole('button', { name: 'Delete obstacle' }))

		expect(deleteComponents).toHaveBeenCalledWith(['Test Object'])
	})

	it('offers Duplicate obstacle under Actions for an obstacle', () => {
		useSimpleObstacle()

		renderPanel()

		expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Duplicate obstacle' })).toBeInTheDocument()
	})

	it('writes an in-place copy named -copy when Duplicate obstacle is pressed', async () => {
		const createComponents = useSimpleObstacle()
		renderPanel()

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate obstacle' }))

		expect(createComponents).toHaveBeenCalledWith([
			expect.objectContaining({
				name: 'Test Object-copy',
				model: 'rdk:builtin:obstacle',
				frame: resource.frame,
			}),
		])
	})

	it('duplicates the selected obstacle on Shift+D', () => {
		const createComponents = useSimpleObstacle()
		renderPanel()

		pressShiftD()

		expect(createComponents).toHaveBeenCalledWith([
			expect.objectContaining({ name: 'Test Object-copy' }),
		])
	})

	it('asks for only obstacles when the selection mixes in another frame', () => {
		useSimpleObstacle([{ ...resource, name: 'other', model: 'rdk:builtin:fake' }])
		const other = world.spawn(traits.Name('other'), traits.FramesAPI, traits.Editable)

		renderPanel({ entities: [entity, other] })

		expect(screen.queryByRole('button', { name: /Duplicate/ })).not.toBeInTheDocument()
		expect(screen.getByText('Select only obstacles to duplicate them.')).toBeInTheDocument()
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

		it('offers Duplicate shape and Delete shape as its actions', () => {
			useComplexObstacle()

			renderPanel()

			expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument()
			expect(screen.getByRole('button', { name: 'Duplicate shape' })).toBeInTheDocument()
			expect(screen.getByRole('button', { name: 'Delete shape' })).toBeInTheDocument()
		})

		it('duplicates the shape, not its obstacle, on Shift+D', () => {
			useComplexObstacle()
			const { createComponents, updateComponents } = vi.mocked(usePartConfig.usePartConfig)()
			renderPanel()

			pressShiftD()

			expect(createComponents).not.toHaveBeenCalled()
			expect(vi.mocked(updateComponents).mock.lastCall?.[0].get('cage')?.attributes).toEqual({
				geometries: [
					{ label: 'a', type: 'box', x: 10, y: 10, z: 10 },
					{ label: 'b', type: 'sphere', r: 5 },
					{ label: 'b-copy', type: 'sphere', r: 5 },
				],
			})
		})

		it('stays read-only without permission to edit the config', () => {
			useComplexObstacle({ hasEditPermissions: false })

			renderPanel()

			expect(screen.queryByLabelText('label')).not.toBeInTheDocument()
			expect(screen.queryByRole('button', { name: 'Delete shape' })).not.toBeInTheDocument()
		})

		it('edits several selected shapes together, offering their shared actions', () => {
			useComplexObstacle()
			const shapeA = world.spawn(
				traits.Name('cage:a'),
				traits.FramesAPI,
				traits.ComplexObstacleShape({ index: 0 })
			)

			renderPanel({ entities: [shapeA, entity] })

			expect(screen.getByLabelText('mutable local position')).toBeInTheDocument()
			expect(
				screen.getByText('The selected shapes have different geometry types.')
			).toBeInTheDocument()
			expect(screen.getByRole('button', { name: 'Duplicate 2 shapes' })).toBeInTheDocument()
			expect(screen.getByRole('button', { name: 'Delete 2 shapes' })).toBeInTheDocument()
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

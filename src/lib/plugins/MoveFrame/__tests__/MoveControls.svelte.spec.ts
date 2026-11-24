import type { ResourceName } from '@viamrobotics/sdk'
import type { Entity } from 'koota'

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { createResourceClient, useResourceStatuses } from '@viamrobotics/svelte-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { axisField, enterNumber } from '#lib/__tests__/__fixtures__/numberFields.js'
import { usePartID } from '#lib/hooks/usePartID.svelte.js'
import { Pose } from '#lib/math/index.js'

import MoveControls from '../MoveControls.svelte'

// Render the panel body without Threlte — the shell reads the scene and the ECS.
vi.mock('#lib/components/overlay/details/DetailsPanel.svelte', async () => {
	const MockDetailsPanel = await import('./__fixtures__/MockDetailsPanel.svelte')
	return { default: MockDetailsPanel.default }
})
// The scene-side components need a Threlte context and import @threlte/extras. Stub
// them out for the panel-body test.
vi.mock('../MoveGizmo.svelte', async () => {
	const MockScene = await import('./__fixtures__/MockSceneComponent.svelte')
	return { default: MockScene.default }
})
vi.mock('../MoveTargetGhost.svelte', async () => {
	const MockScene = await import('./__fixtures__/MockSceneComponent.svelte')
	return { default: MockScene.default }
})

// Ghosts are entities in the real world. The panel-body test has no ECS.
vi.mock('../useMoveGhosts.svelte', () => ({
	useMoveGhosts: () => undefined,
}))

// The frame's live world transform normally comes from a robot `getPose` poll. Hand the
// panel a fixed one so the pose inputs have something to seed from.
const moved = vi.hoisted(() => ({ matrix: undefined as unknown }))
vi.mock('../useMovedFrameMatrix.svelte', () => ({
	useMovedFrameMatrix: () => ({
		get current() {
			return moved.matrix
		},
	}),
}))

// MoveControls dependencies the panel-body test does not exercise.
vi.mock('#lib/hooks/useSettings.svelte.js', () => ({
	RefreshRates: { poses: 'poses' },
	useSettings: () => ({
		current: { interactionMode: 'navigate', refreshRates: { poses: 500 } },
	}),
}))
vi.mock('@viamrobotics/prime-ui', async (importOriginal) => ({
	...(await importOriginal<typeof import('@viamrobotics/prime-ui')>()),
	useToast: () => ({ success: vi.fn(), warning: vi.fn(), danger: vi.fn(), info: vi.fn() }),
}))

vi.mock('@viamrobotics/svelte-sdk', () => ({
	useResourceStatuses: vi.fn(),
	createResourceClient: vi.fn(() => ({ current: undefined })),
	useRobotClient: vi.fn(() => ({ current: undefined })),
	createRobotQuery: vi.fn(() => ({ data: undefined })),
}))
vi.mock('#lib/hooks/usePartID.svelte.js', () => ({ usePartID: vi.fn() }))
vi.mock('#lib/hooks/use3DModels.svelte.js', () => ({
	use3DModels: () => ({ current: {}, arms: [], shouldRender: false, parseArm: vi.fn() }),
	matchModel: () => undefined,
}))
vi.mock('#lib/hooks/useArmClient.svelte.js', () => ({
	useArmClient: () => ({ names: [], currentPositions: {} }),
}))

const service = (name: string) =>
	({
		name: { namespace: 'rdk', type: 'service', subtype: 'motion', name },
	}) as unknown as ResourceName

/** The panel only hands the entity to the shell and the ghosts, both stubbed here. */
const entity = 1 as unknown as Entity

describe('MoveControls', () => {
	const partID = 'part1'

	beforeEach(() => {
		vi.clearAllMocks()
		moved.matrix = undefined
		// The panel remembers its tab in storage, so one test's tab choice would open the next on it.
		localStorage.clear()

		vi.mocked(usePartID).mockReturnValue({ current: partID } as never)
		// A service name comes from cache, but commanding needs a connected client. The panel gates on
		// the client, so the default here is connected and the disconnected case is its own test.
		vi.mocked(createResourceClient).mockReturnValue({
			current: { doCommand: vi.fn() },
		} as never)
	})

	it('selects the built-in motion service by default', () => {
		vi.mocked(useResourceStatuses).mockReturnValue({
			current: [service('planner'), service('builtin')],
		} as never)

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		expect(screen.getByRole('combobox', { name: 'motion service' })).toHaveTextContent('builtin')
	})

	it('falls back to the first motion service when there is no built-in', () => {
		vi.mocked(useResourceStatuses).mockReturnValue({
			current: [service('planner'), service('secondary')],
		} as never)

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		expect(screen.getByRole('combobox', { name: 'motion service' })).toHaveTextContent('planner')
	})

	it('opens on the Move tab, with Move and without the preview', () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /preview move/i })).not.toBeInTheDocument()
	})

	it('offers the preview on the Preview tab', async () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)
		render(MoveControls, { props: { entity, frameName: 'arm' } })

		await fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))

		expect(await screen.findByRole('button', { name: /preview move/i })).toBeInTheDocument()
	})

	it('mounts the plan action disabled rather than hiding it until a plan exists', async () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)
		render(MoveControls, { props: { entity, frameName: 'arm' } })

		await fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))

		expect(await screen.findByRole('button', { name: 'Execute plan' })).toHaveAttribute(
			'aria-disabled',
			'true'
		)
	})

	it('holds the actions back until a client is connected, not merely named', async () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)
		vi.mocked(createResourceClient).mockReturnValue({ current: undefined } as never)
		moved.matrix = new Pose(100, -250, 40).toMatrix4()

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		await enterNumber(axisField('move target position (mm)', 'X'), '500')

		expect(screen.getByRole('button', { name: /reset/i })).not.toHaveAttribute('aria-disabled')
		expect(screen.getByRole('button', { name: 'Move' })).toHaveAttribute('aria-disabled', 'true')
	})

	it('waits for the frame pose before offering the pose inputs', () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		expect(
			screen.queryByRole('group', { name: 'move target position (mm)' })
		).not.toBeInTheDocument()
		expect(screen.getByText(/resolving the frame's pose/i)).toBeInTheDocument()
	})

	it('seeds editable position and orientation inputs from the frame pose', async () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)
		moved.matrix = new Pose(100, -250, 40).toMatrix4()

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		expect(axisField('move target position (mm)', 'X')).toHaveValue(100)
		expect(axisField('move target position (mm)', 'Y')).toHaveValue(-250)
		expect(axisField('move target position (mm)', 'Z')).toHaveValue(40)
		expect(
			screen.getByRole('group', { name: 'move target orientation (Euler, deg)' })
		).toBeInTheDocument()
	})

	it('stages a target when a pose field is edited', async () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)
		moved.matrix = new Pose(100, -250, 40).toMatrix4()

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		// Nothing is staged until a field moves, so both actions start disabled.
		expect(screen.getByRole('button', { name: /reset/i })).toHaveAttribute('aria-disabled', 'true')

		await enterNumber(axisField('move target position (mm)', 'X'), '500')

		expect(screen.getByRole('button', { name: /reset/i })).not.toHaveAttribute('aria-disabled')
		expect(screen.getByRole('button', { name: 'Move' })).not.toHaveAttribute('aria-disabled')
		expect(
			within(screen.getByRole('tabpanel', { name: 'Move' })).getByText(/400\.0 mm · 0\.0°/),
			'400 mm of travel along x, no rotation'
		).toBeInTheDocument()
	})
})

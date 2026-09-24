import type { ResourceName } from '@viamrobotics/sdk'
import type { Entity } from 'koota'

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { createResourceClient, useResourceStatuses } from '@viamrobotics/svelte-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePartID } from '$lib/hooks/usePartID.svelte'
import { Pose } from '$lib/math'

import MoveControls from '../MoveControls.svelte'

// Render the panel body without Threlte — the shell reads the scene and the ECS.
vi.mock('$lib/components/overlay/details/DetailsPanel.svelte', async () => {
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
vi.mock('../useMoveGhosts.svelte', () => ({ useMoveGhosts: () => undefined }))

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
vi.mock('$lib/hooks/useSettings.svelte', () => ({
	RefreshRates: { poses: 'poses' },
	useSettings: () => ({
		current: { interactionMode: 'navigate', refreshRates: { poses: 500 } },
	}),
}))
vi.mock('@viamrobotics/prime-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@viamrobotics/prime-core')>()),
	useToast: () => vi.fn(),
}))

vi.mock('@viamrobotics/svelte-sdk', () => ({
	useResourceStatuses: vi.fn(),
	createResourceClient: vi.fn(() => ({ current: undefined })),
	useRobotClient: vi.fn(() => ({ current: undefined })),
	createRobotQuery: vi.fn(() => ({ data: undefined })),
}))
vi.mock('$lib/hooks/usePartID.svelte', () => ({ usePartID: vi.fn() }))

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

		expect(screen.getByText('motion service')).toBeInTheDocument()
		expect(screen.getByRole('combobox')).toHaveValue('builtin')
	})

	it('falls back to the first motion service when there is no built-in', () => {
		vi.mocked(useResourceStatuses).mockReturnValue({
			current: [service('planner'), service('secondary')],
		} as never)

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		expect(screen.getByText('motion service')).toBeInTheDocument()
		expect(screen.getByRole('combobox')).toHaveValue('planner')
	})

	it('offers the preview action alongside the move it previews', () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		expect(screen.getByRole('button', { name: /preview move/i })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument()
	})

	it('mounts the plan action disabled rather than hiding it until a plan exists', () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		expect(screen.getByRole('button', { name: 'Execute plan' })).toHaveAttribute(
			'aria-disabled',
			'true'
		)
	})

	it('holds the actions back until a client is connected, not merely named', async () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)
		vi.mocked(createResourceClient).mockReturnValue({ current: undefined } as never)
		moved.matrix = new Pose(100, -250, 40).toMatrix4()

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		const position = await screen.findByLabelText('move target position')
		const x = position.querySelector('input')
		if (!x) throw new Error('expected a position field')
		await fireEvent.change(x, { target: { value: '500' } })

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /reset/i })).not.toHaveAttribute('aria-disabled')
		})
		expect(screen.getByRole('button', { name: 'Move' })).toHaveAttribute('aria-disabled', 'true')
	})

	it('waits for the frame pose before offering the pose inputs', () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		expect(screen.queryByLabelText('move target position')).not.toBeInTheDocument()
		expect(screen.getByText(/resolving the frame's pose/i)).toBeInTheDocument()
	})

	it('seeds editable position and orientation inputs from the frame pose', async () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)
		moved.matrix = new Pose(100, -250, 40).toMatrix4()

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		const position = await screen.findByLabelText('move target position')
		expect(screen.getByLabelText('move target orientation')).toBeInTheDocument()
		expect(screen.getByText('world position')).toBeInTheDocument()
		expect(screen.getByText('world orientation')).toBeInTheDocument()

		const fields = position.querySelectorAll('input')
		expect([...fields].map((field) => Number(field.value))).toEqual([100, -250, 40])
	})

	it('stages a target when a pose field is edited', async () => {
		vi.mocked(useResourceStatuses).mockReturnValue({ current: [service('builtin')] } as never)
		moved.matrix = new Pose(100, -250, 40).toMatrix4()

		render(MoveControls, { props: { entity, frameName: 'arm' } })

		// Nothing is staged until a field moves, so both actions start disabled.
		expect(screen.getByRole('button', { name: /reset/i })).toHaveAttribute('aria-disabled', 'true')

		const position = await screen.findByLabelText('move target position')
		const x = position.querySelector('input')
		if (!x) throw new Error('expected a position field')
		await fireEvent.change(x, { target: { value: '500' } })

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /reset/i })).not.toHaveAttribute('aria-disabled')
		})
		expect(screen.getByRole('button', { name: 'Move' })).not.toHaveAttribute('aria-disabled')
		// 400 mm of travel along x, no rotation.
		expect(screen.getByText(/400\.0 mm · 0\.0°/)).toBeInTheDocument()
	})
})

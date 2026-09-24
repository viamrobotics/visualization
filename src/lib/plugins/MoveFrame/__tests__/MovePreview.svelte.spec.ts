import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { TrajectoryPlayer } from '$lib/motion/trajectoryPlayer.svelte'

import type { PreviewMove, PreviewStatus } from '../usePreviewMove.svelte'

import MovePreview from '../MovePreview.svelte'

const player = (overrides: Partial<TrajectoryPlayer> = {}): TrajectoryPlayer => ({
	currentStep: 0,
	totalSteps: 0,
	lastStep: 0,
	isPlaying: false,
	atEnd: true,
	play: vi.fn(),
	pause: vi.fn(),
	toggle: vi.fn(),
	seek: vi.fn(),
	stepBy: vi.fn(),
	reset: vi.fn(),
	...overrides,
})

const preview = (overrides: Partial<PreviewMove> = {}): PreviewMove => ({
	status: 'idle',
	message: undefined,
	trajectory: [],
	plannedSteps: 0,
	waypointIndices: [],
	detail: 'waypoints',
	player: player(),
	requestPreview: vi.fn(),
	clear: vi.fn(),
	...overrides,
})

describe('MovePreview', () => {
	it('offers to plan a preview before one exists, with neither live region on screen', () => {
		render(MovePreview, { props: { preview: preview(), frameName: 'arm' } })

		expect(screen.getByRole('button', { name: /preview move/i })).toBeInTheDocument()
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.queryByRole('slider')).not.toBeInTheDocument()
	})

	it.each([
		['error', 'Motion service returned no trajectory for this move.', 'alert'],
		['error', 'no plan found within the constraints', 'alert'],
		['already-at-goal', '"arm" is already at the target.', 'status'],
	] satisfies [PreviewStatus, string, 'alert' | 'status'][])(
		'reports a %s message through role=%s',
		(status, message, role) => {
			render(MovePreview, { props: { preview: preview({ status, message }), frameName: 'arm' } })

			expect(screen.getByRole(role)).toHaveTextContent(message)
		}
	)

	it('offers to re-plan once a preview is ready, and says what playback is made of', () => {
		render(MovePreview, {
			props: {
				preview: preview({
					status: 'ready',
					plannedSteps: 12,
					player: player({ totalSteps: 12, lastStep: 11 }),
				}),
				frameName: 'arm',
			},
		})

		expect(screen.getByRole('button', { name: /re-plan preview/i })).toBeInTheDocument()
		expect(screen.getByText('This preview is an approximation')).toBeInTheDocument()
		expect(screen.getByRole('status')).toHaveTextContent(
			'12 frames, one per configuration the planner returned'
		)
	})

	it('spells out the caveat under the approximation notice', () => {
		render(MovePreview, {
			props: { preview: preview({ status: 'ready', plannedSteps: 12 }), frameName: 'arm' },
		})

		expect(
			screen.getByText(/how it moves between them is the component's decision/i)
		).toBeInTheDocument()
	})

	it('counts interpolated frames against the waypoints they span', () => {
		render(MovePreview, {
			props: {
				preview: preview({
					status: 'ready',
					detail: 'interpolated',
					plannedSteps: 4,
					player: player({ totalSteps: 96, lastStep: 95 }),
				}),
				frameName: 'arm',
			},
		})

		expect(screen.getByRole('status')).toHaveTextContent('96 frames across 4 planned waypoints')
	})

	it('switches what a frame represents when the toggle is used', async () => {
		const setDetail = vi.fn()
		const state = preview({
			status: 'ready',
			plannedSteps: 4,
			player: player({ totalSteps: 4, lastStep: 3 }),
		})
		Object.defineProperty(state, 'detail', {
			get: () => 'waypoints',
			set: setDetail,
		})
		render(MovePreview, { props: { preview: state, frameName: 'arm' } })

		await userEvent.click(screen.getByRole('button', { name: 'Interpolated' }))

		expect(setDetail).toHaveBeenCalledWith('interpolated')
	})

	it('shows which framing is in effect', () => {
		render(MovePreview, {
			props: {
				preview: preview({ status: 'ready', detail: 'interpolated', plannedSteps: 4 }),
				frameName: 'arm',
			},
		})

		expect(screen.getByRole('button', { name: 'Interpolated' })).toHaveAttribute(
			'aria-pressed',
			'true'
		)
		expect(screen.getByRole('button', { name: 'Waypoints' })).toHaveAttribute(
			'aria-pressed',
			'false'
		)
	})

	it('plans when the panel has a goal staged', async () => {
		const requestPreview = vi.fn()
		render(MovePreview, { props: { preview: preview({ requestPreview }), frameName: 'arm' } })

		await userEvent.click(screen.getByRole('button', { name: /preview move/i }))

		expect(requestPreview).toHaveBeenCalled()
	})

	it('does not plan again while a request is already open', async () => {
		const requestPreview = vi.fn()
		render(MovePreview, {
			props: { preview: preview({ status: 'planning', requestPreview }), frameName: 'arm' },
		})

		await userEvent.click(screen.getByRole('button', { name: /preview move/i }))

		expect(requestPreview).not.toHaveBeenCalled()
	})

	it('does not plan when the panel has nothing to plan', async () => {
		const requestPreview = vi.fn()
		render(MovePreview, {
			props: { preview: preview({ requestPreview }), frameName: 'arm', disabled: true },
		})

		await userEvent.click(screen.getByRole('button', { name: /preview move/i }))

		expect(requestPreview).not.toHaveBeenCalled()
	})

	it('offers a scrubber labelled for the frame it previews', () => {
		render(MovePreview, {
			props: {
				preview: preview({ status: 'ready', player: player({ totalSteps: 2, lastStep: 1 }) }),
				frameName: 'arm',
			},
		})

		expect(screen.getByRole('slider', { name: 'arm preview step' })).toBeInTheDocument()
	})
})

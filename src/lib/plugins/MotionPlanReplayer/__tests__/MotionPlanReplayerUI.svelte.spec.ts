import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { type World } from 'koota'
import { flushSync } from 'svelte'
import { UuidTool } from 'uuid-tool'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PoseInFrame, Transform } from '$lib/buf/common/v1/common_pb'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { traits } from '$lib/ecs'

import type { MotionPlanReplayerContext } from '../useMotionPlanReplayer.svelte'

import ReplayerUIHarness from './__fixtures__/ReplayerUIHarness.svelte'

// The real panel seeds its position from `useThrelte().dom`, which the global `@threlte/core` mock
// has no field for, so it throws on mount outside a Canvas.
vi.mock('$lib/components/overlay/FloatingPanel.svelte', async () => {
	const MockFloatingPanel = await import('./__fixtures__/MockFloatingPanel.svelte')
	return { default: MockFloatingPanel.default }
})

// The `$lib` barrel re-exports `App.svelte` and pulls the whole Threlte component tree in with it.
// `DashboardPortal` is only a `Portal`, already mocked globally to a passthrough.
vi.mock('$lib', async () => {
	const MockDashboardPortal = await import('./__fixtures__/MockDashboardPortal.svelte')
	return { DashboardPortal: MockDashboardPortal.default }
})

// useToast requires a `provideToast` ancestor; nothing here checks toast content.
vi.mock('@viamrobotics/prime-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@viamrobotics/prime-core')>()),
	useToast: () => vi.fn(),
}))

const planSnapshot = new Snapshot({
	transforms: [
		new Transform({
			referenceFrame: 'plan-frame',
			poseInObserverFrame: new PoseInFrame({ referenceFrame: 'world' }),
			uuid: Uint8Array.from(UuidTool.toBytes('00000000-0000-4000-8000-000000000000')),
		}),
	],
})

const drawnFrameNames = (world: World): string[] =>
	world
		.query(traits.Name)
		.map((entity) => entity.get(traits.Name))
		.filter((name) => name === 'plan-frame')

describe('MotionPlanReplayerUI', () => {
	it('opens the replayer panel on mount', () => {
		render(ReplayerUIHarness)

		expect(screen.getByRole('radio', { name: 'Motion Plan Replayer' })).toBeChecked()
		expect(screen.getByRole('button', { name: 'Upload plan JSON' })).toBeVisible()
	})

	it('closes the panel from the dashboard button', async () => {
		const user = userEvent.setup()
		render(ReplayerUIHarness)

		await user.click(screen.getByRole('radio', { name: 'Motion Plan Replayer' }))

		expect(screen.queryByRole('button', { name: 'Upload plan JSON' })).not.toBeInTheDocument()
	})

	it('renders two plans that share a name as distinct rows', () => {
		render(ReplayerUIHarness, {
			props: {
				plans: [
					{ name: 'same.json', content: 'content-a' },
					{ name: 'same.json', content: 'content-b' },
				],
			},
		})

		expect(screen.getAllByRole('button', { name: 'Remove plan' })).toHaveLength(2)
	})

	describe('when unmounted by leaving replay mode', () => {
		let ctx: MotionPlanReplayerContext
		let world: World

		beforeEach(async () => {
			const { rerender } = render(ReplayerUIHarness, {
				props: {
					onReady: (readyCtx: MotionPlanReplayerContext, readyWorld: World) => {
						ctx = readyCtx
						world = readyWorld
					},
				},
			})
			ctx.addPlan('plan.json', 'content', [planSnapshot])
			ctx.selectPlan(0)
			flushSync()
			expect(drawnFrameNames(world), 'the plan should be drawn before unmounting').toEqual([
				'plan-frame',
			])

			await rerender({ showUI: false })
		})

		afterEach(() => {
			world.destroy()
		})

		it('clears the active plan', () => {
			expect(ctx.activePlanIndex).toBeNull()
		})

		it('removes the plan geometry from the scene', () => {
			expect(drawnFrameNames(world)).toEqual([])
		})

		it('keeps the loaded plans', () => {
			expect(ctx.plans.map((plan) => plan.name)).toEqual(['plan.json'])
		})
	})
})

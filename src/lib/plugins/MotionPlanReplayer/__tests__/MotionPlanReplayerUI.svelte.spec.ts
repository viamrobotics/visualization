import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

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

describe('MotionPlanReplayerUI', () => {
	it('renders two plans that share a name as distinct rows', async () => {
		const user = userEvent.setup()
		render(ReplayerUIHarness, {
			props: {
				plans: [
					{ name: 'same.json', content: 'content-a' },
					{ name: 'same.json', content: 'content-b' },
				],
			},
		})

		await user.click(screen.getByRole('radio', { name: 'Motion Plan Replayer' }))

		expect(screen.getAllByRole('button', { name: 'Remove plan' })).toHaveLength(2)
	})
})

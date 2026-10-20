import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { TRANSFORM_GIZMOS_CONTEXT_KEY } from '$lib/hooks/useTransformGizmos.svelte'

import KinematicsDashboard from '../KinematicsDashboard.svelte'
import { fakeWorkbench } from './__fixtures__/fakeWorkbench'

vi.mock('$lib/components/overlay/Portals/DashboardPortal.svelte', async () => {
	const passthrough = await import('./__fixtures__/PassthroughPortal.svelte')
	return { default: passthrough.default }
})

vi.mock('@viamrobotics/prime-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@viamrobotics/prime-core')>()),
	useToast: () => vi.fn(),
}))

vi.mock('$lib/hooks/useSettings.svelte', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/hooks/useSettings.svelte')>()),
	useSettings: () => ({
		current: { snapping: false, snapTranslate: 0.1, snapRotate: 7.5, snapScale: 0.1 },
	}),
}))

const transformGizmos = new Map([
	[
		TRANSFORM_GIZMOS_CONTEXT_KEY,
		{ availableModes: new Set(), select: vi.fn(), register: () => () => {} },
	],
])

const renderDashboard = (gizmoMode?: 'translate' | 'rotate') => {
	const { workbench } = fakeWorkbench()
	render(KinematicsDashboard, {
		props: { workbench, gizmoMode },
		context: transformGizmos,
	})
}

describe('<KinematicsDashboard>', () => {
	it('defaults Visual off and Collision on', () => {
		renderDashboard()

		expect(screen.getByRole('switch', { name: 'Visual' })).toHaveAttribute('aria-checked', 'false')
		expect(screen.getByRole('switch', { name: 'Collision' })).toHaveAttribute(
			'aria-checked',
			'true'
		)
	})

	it('toggles each switch independently', async () => {
		renderDashboard()
		const visual = screen.getByRole('switch', { name: 'Visual' })
		const collision = screen.getByRole('switch', { name: 'Collision' })

		await userEvent.click(visual)
		expect(visual).toHaveAttribute('aria-checked', 'true')
		expect(collision).toHaveAttribute('aria-checked', 'true')

		await userEvent.click(collision)
		expect(collision).toHaveAttribute('aria-checked', 'false')
		expect(visual).toHaveAttribute('aria-checked', 'true')

		await userEvent.click(visual)
		expect(visual).toHaveAttribute('aria-checked', 'false')
	})

	it('switches the gizmo between Translate and Rotate', async () => {
		renderDashboard('translate')
		const translate = screen.getByRole('switch', { name: 'Translate' })
		const rotate = screen.getByRole('switch', { name: 'Rotate' })

		await userEvent.click(rotate)

		expect(rotate).toHaveAttribute('aria-checked', 'true')
		expect(translate).toHaveAttribute('aria-checked', 'false')
	})

	it('hides the gizmo when the active mode is clicked again', async () => {
		renderDashboard('translate')
		const translate = screen.getByRole('switch', { name: 'Translate' })

		await userEvent.click(translate)

		expect(translate).toHaveAttribute('aria-checked', 'false')
		expect(screen.getByRole('switch', { name: 'Rotate' })).toHaveAttribute('aria-checked', 'false')
	})
})

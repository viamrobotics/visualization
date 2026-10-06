import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import { Color } from 'three'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'

import ConfigAppearanceDetails from '../ConfigAppearanceDetails.svelte'

const world = createWorld()

beforeEach(() => {
	world.reset()
})

const mountDetails = (visualizer: Record<string, unknown>, frameId?: string) => {
	const component: PartComponent = { name: 'cage', visualizer }
	const partConfig = createPartConfigFixture({ current: { components: [component] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)
	const name = frameId === undefined ? 'cage' : `cage:${frameId}`
	const entity = world.spawn(traits.Name(name), traits.Color(new Color('#888888')))

	render(ConfigAppearanceDetails, {
		props: { entity, component, frameId },
		context: new Map([[WORLD_CONTEXT_KEY, world]]),
	})

	return partConfig
}

const lastVisualizer = (partConfig: ReturnType<typeof mountDetails>) =>
	vi.mocked(partConfig.updateComponent).mock.lastCall?.[1].visualizer

describe('ConfigAppearanceDetails', () => {
	it('shows the saved switches', () => {
		mountDetails({ type: 'complex', show_axes_helper: false })

		expect(screen.getByRole('switch', { name: 'visible' })).toHaveAttribute('aria-checked', 'true')
		expect(screen.getByRole('switch', { name: 'show axes helper' })).toHaveAttribute(
			'aria-checked',
			'false'
		)
	})

	it('saves a hidden resource as invisible and keeps the obstacle hint', async () => {
		const partConfig = mountDetails({ type: 'complex' })

		await userEvent.click(screen.getByRole('switch', { name: 'visible' }))

		expect(lastVisualizer(partConfig)).toEqual({ type: 'complex', invisible: true })
	})

	it('removes the saved key when the axes helper goes back to its default', async () => {
		const partConfig = mountDetails({ type: 'complex', show_axes_helper: false })

		await userEvent.click(screen.getByRole('switch', { name: 'show axes helper' }))

		expect(lastVisualizer(partConfig)).toEqual({ type: 'complex' })
	})

	it('saves a typed opacity', async () => {
		const partConfig = mountDetails({ type: 'complex' })
		const input = screen.getByLabelText('saved opacity').querySelector<HTMLInputElement>('input')!

		await userEvent.tripleClick(input)
		await userEvent.keyboard('0.35{Tab}')

		await vi.waitFor(() =>
			expect(lastVisualizer(partConfig)).toEqual({ type: 'complex', opacity: 0.35 })
		)
	})

	it('resets every saved appearance key and keeps the obstacle hint', async () => {
		const partConfig = mountDetails({ type: 'complex', color: '#ff0000', opacity: 0.2 })

		await userEvent.click(screen.getByRole('button', { name: 'Reset appearance' }))

		expect(lastVisualizer(partConfig)).toEqual({ type: 'complex' })
	})

	it('offers no reset when nothing is saved', () => {
		mountDetails({ type: 'complex' })

		expect(screen.queryByRole('button', { name: 'Reset appearance' })).not.toBeInTheDocument()
	})

	it('clears what the frames inside save and keeps the component values', async () => {
		const partConfig = mountDetails({ opacity: 0.5, frames: { post: { opacity: 0.9 } } })

		await userEvent.click(screen.getByRole('button', { name: 'Reset children' }))

		expect(lastVisualizer(partConfig)).toEqual({ opacity: 0.5 })
	})
})

describe('ConfigAppearanceDetails for a frame inside a resource', () => {
	it('shows the values it follows from the resource', () => {
		mountDetails({ show_axes_helper: false }, 'post')

		expect(screen.getByRole('switch', { name: 'show axes helper' })).toHaveAttribute(
			'aria-checked',
			'false'
		)
	})

	it('saves a typed opacity under its own id', async () => {
		const partConfig = mountDetails({ type: 'complex', opacity: 0.5 }, 'post')
		const input = screen.getByLabelText('saved opacity').querySelector<HTMLInputElement>('input')!

		await userEvent.tripleClick(input)
		await userEvent.keyboard('0.35{Tab}')

		await vi.waitFor(() =>
			expect(lastVisualizer(partConfig)).toEqual({
				type: 'complex',
				opacity: 0.5,
				frames: { post: { opacity: 0.35 } },
			})
		)
	})

	it('saves turning the axes helper back on against a resource that turns it off', async () => {
		const partConfig = mountDetails({ show_axes_helper: false }, 'post')

		await userEvent.click(screen.getByRole('switch', { name: 'show axes helper' }))

		expect(lastVisualizer(partConfig)).toEqual({
			show_axes_helper: false,
			frames: { post: { show_axes_helper: true } },
		})
	})

	it('goes back to following the resource on reset', async () => {
		const partConfig = mountDetails({ opacity: 0.5, frames: { post: { opacity: 0.9 } } }, 'post')

		await userEvent.click(screen.getByRole('button', { name: 'Reset to cage' }))

		expect(lastVisualizer(partConfig)).toEqual({ opacity: 0.5 })
	})
})

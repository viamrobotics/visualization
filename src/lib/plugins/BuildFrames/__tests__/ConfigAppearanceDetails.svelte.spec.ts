import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import { Color } from 'three'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PartComponent } from '#lib/hooks/usePartConfig.svelte.js'

import { createPartConfigFixture } from '#lib/__tests__/__fixtures__/partConfig.js'
import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'
import * as usePartConfig from '#lib/hooks/usePartConfig.svelte.js'

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
		props: { targets: [{ entity, component, frameId }] },
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
		const input = screen.getByLabelText('mutable opacity').querySelector<HTMLInputElement>('input')!

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

	it('shows a saved #808080 as its sRGB channels, not three.js linear ones', () => {
		mountDetails({ color: '#808080' })

		const input = screen.getByLabelText('mutable color').querySelector<HTMLInputElement>('input')!

		expect(input.value).toBe('{r: 0.50, g: 0.50, b: 0.50}')
	})

	it('saves a typed hex as the same hex', async () => {
		const partConfig = mountDetails({})
		const input = screen.getByLabelText('mutable color').querySelector<HTMLInputElement>('input')!

		await userEvent.tripleClick(input)
		await userEvent.keyboard('#ff8000{Tab}')

		await vi.waitFor(() => expect(lastVisualizer(partConfig)).toEqual({ color: '#ff8000' }))
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
		const input = screen.getByLabelText('mutable opacity').querySelector<HTMLInputElement>('input')!

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

describe('ConfigAppearanceDetails for two frames inside one resource', () => {
	const mountTwoFrames = (visualizer: Record<string, unknown>) => {
		const component: PartComponent = { name: 'cage', visualizer }
		const partConfig = createPartConfigFixture({ current: { components: [component] } })
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)

		render(ConfigAppearanceDetails, {
			props: {
				targets: ['post', 'rail'].map((frameId) => ({
					entity: world.spawn(traits.Name(`cage:${frameId}`)),
					component,
					frameId,
				})),
			},
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		return partConfig
	}

	it('shows a switch the frames disagree on as off beside a dash', () => {
		mountTwoFrames({ frames: { post: { show_axes_helper: false } } })

		expect(screen.getByRole('switch', { name: 'show axes helper, mixed' })).toHaveAttribute(
			'aria-checked',
			'false'
		)
	})

	it('saves one change to both frames in a single write, keeping neither frame out', async () => {
		const partConfig = mountTwoFrames({ type: 'complex' })

		await userEvent.click(screen.getByRole('switch', { name: 'visible' }))

		expect(vi.mocked(partConfig.updateComponent)).toHaveBeenCalledTimes(1)
		expect(lastVisualizer(partConfig)).toEqual({
			type: 'complex',
			frames: { post: { invisible: true }, rail: { invisible: true } },
		})
	})
})

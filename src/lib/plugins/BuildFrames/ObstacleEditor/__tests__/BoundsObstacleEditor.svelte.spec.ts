import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { generateBoundsGeometries } from '$lib/boundsGeometries'
import { createFrame } from '$lib/frame'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import { type PartComponent } from '$lib/hooks/usePartConfig.svelte'
import {
	type BoundsHint,
	OBSTACLE_API,
	OBSTACLE_MODEL,
	type ObstacleAttributes,
} from '$lib/obstacleAttributes'

import ObstacleEditor from '../ObstacleEditor.svelte'

const hint: BoundsHint = {
	type: 'bounds',
	x_mm: 1000,
	y_mm: 800,
	z_mm: 600,
	wall_thickness_mm: 20,
	exclude: [],
}

const mountEditor = (initial: BoundsHint = hint, { isHintStored = true } = {}) => {
	const attributes: ObstacleAttributes & { extra: string } = {
		geometries: generateBoundsGeometries(initial),
		extra: 'kept',
	}
	const component: PartComponent = {
		name: 'obstacle-1',
		api: OBSTACLE_API,
		model: OBSTACLE_MODEL,
		frame: createFrame(),
		attributes,
		...(isHintStored && { visualizer: { ...initial } }),
	}
	const partConfig = createPartConfigFixture({ current: { components: [component] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)

	render(ObstacleEditor, { props: { name: 'obstacle-1' } })

	return partConfig
}

describe('BoundsObstacleEditor', () => {
	beforeEach(() => vi.clearAllMocks())

	it('writes the next hint and its geometries together on an interior edit', async () => {
		const partConfig = mountEditor()
		await vi.waitFor(() => expect(document.querySelector('.tp-pndtxtv input')).not.toBeNull())

		await userEvent.tripleClick(document.querySelector<HTMLInputElement>('.tp-pndtxtv input')!)
		await userEvent.keyboard('1500{Tab}')

		const next: BoundsHint = { ...hint, x_mm: 1500 }
		await vi.waitFor(() =>
			expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
				attributes: { geometries: generateBoundsGeometries(next), extra: 'kept' },
				visualizer: next,
			})
		)
		expect(partConfig.updateFrame).not.toHaveBeenCalled()
	})

	it('adds an unchecked wall to exclude', async () => {
		const partConfig = mountEditor()

		await userEvent.click(screen.getByLabelText('Ceiling'))

		const next: BoundsHint = { ...hint, exclude: ['ceiling'] }
		await vi.waitFor(() =>
			expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
				attributes: { geometries: generateBoundsGeometries(next), extra: 'kept' },
				visualizer: next,
			})
		)
		expect(partConfig.updateFrame).not.toHaveBeenCalled()
	})

	it('keeps exclude in face order', async () => {
		const partConfig = mountEditor({ ...hint, exclude: ['ceiling'] })

		await userEvent.click(screen.getByLabelText('+X wall'))

		await vi.waitFor(() =>
			expect(partConfig.updateComponent).toHaveBeenLastCalledWith(
				'obstacle-1',
				expect.objectContaining({ visualizer: { ...hint, exclude: ['x_max', 'ceiling'] } })
			)
		)
	})

	it('writes nothing for a thickness of 0', async () => {
		const partConfig = mountEditor()
		await vi.waitFor(() =>
			expect(document.querySelector('[aria-label="mutable wall thickness"] input')).not.toBeNull()
		)

		await userEvent.tripleClick(
			document.querySelector<HTMLInputElement>('[aria-label="mutable wall thickness"] input')!
		)
		await userEvent.keyboard('0{Tab}')

		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(partConfig.updateComponent).not.toHaveBeenCalled()
		expect(partConfig.updateFrame).not.toHaveBeenCalled()
	})

	it('writes a positive thickness', async () => {
		const partConfig = mountEditor()
		await vi.waitFor(() =>
			expect(document.querySelector('[aria-label="mutable wall thickness"] input')).not.toBeNull()
		)

		await userEvent.tripleClick(
			document.querySelector<HTMLInputElement>('[aria-label="mutable wall thickness"] input')!
		)
		await userEvent.keyboard('35{Tab}')

		const next: BoundsHint = { ...hint, wall_thickness_mm: 35 }
		await vi.waitFor(() =>
			expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
				attributes: { geometries: generateBoundsGeometries(next), extra: 'kept' },
				visualizer: next,
			})
		)
	})

	it('reads the form from the walls of an obstacle stored without a hint, and writes one', async () => {
		const partConfig = mountEditor(hint, { isHintStored: false })
		const selector = '[aria-label="mutable wall thickness"] input'
		await vi.waitFor(() => expect(document.querySelector(selector)).not.toBeNull())

		await userEvent.tripleClick(document.querySelector<HTMLInputElement>(selector)!)
		await userEvent.keyboard('35{Tab}')

		const next: BoundsHint = { ...hint, wall_thickness_mm: 35 }
		await vi.waitFor(() =>
			expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
				attributes: { geometries: generateBoundsGeometries(next), extra: 'kept' },
				visualizer: next,
			})
		)
	})

	it('writes a thickness above 100 from a thinner wall', async () => {
		const thin: BoundsHint = { ...hint, wall_thickness_mm: 10 }
		const partConfig = mountEditor(thin)
		const selector = '[aria-label="mutable wall thickness"] input'
		await vi.waitFor(() => expect(document.querySelector(selector)).not.toBeNull())

		await userEvent.tripleClick(document.querySelector<HTMLInputElement>(selector)!)
		await userEvent.keyboard('250{Tab}')

		const next: BoundsHint = { ...thin, wall_thickness_mm: 250 }
		await vi.waitFor(() =>
			expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
				attributes: { geometries: generateBoundsGeometries(next), extra: 'kept' },
				visualizer: next,
			})
		)
	})
})

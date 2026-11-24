import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { axisField, enterNumber, numberField } from '#lib/__tests__/__fixtures__/numberFields.js'
import { createPartConfigFixture } from '#lib/__tests__/__fixtures__/partConfig.js'
import { generateBoundsGeometries } from '#lib/boundsGeometries.js'
import { createFrame } from '#lib/frame.js'
import * as usePartConfig from '#lib/hooks/usePartConfig.svelte.js'
import { type PartComponent } from '#lib/hooks/usePartConfig.svelte.js'
import {
	type BoundsHint,
	OBSTACLE_API,
	OBSTACLE_MODEL,
	type ObstacleAttributes,
} from '#lib/obstacleAttributes.js'

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

const thicknessField = () => numberField('wall thickness (mm)')

describe('BoundsObstacleEditor', () => {
	beforeEach(() => vi.clearAllMocks())

	it('writes the next hint and its geometries together on an interior edit', async () => {
		const partConfig = mountEditor()
		await enterNumber(axisField('interior size (mm)', 'X'), '1500')

		const next: BoundsHint = { ...hint, x_mm: 1500 }
		expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
			attributes: { geometries: generateBoundsGeometries(next), extra: 'kept' },
			visualizer: next,
		})
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

	it('ignores a thickness of 0, which no bounds hint accepts', async () => {
		const partConfig = mountEditor()

		await enterNumber(thicknessField(), '0')

		expect(partConfig.updateComponent).not.toHaveBeenCalled()
	})

	it('keeps the last included wall from being unchecked', async () => {
		const partConfig = mountEditor({
			...hint,
			exclude: ['x_max', 'x_min', 'y_max', 'y_min', 'ceiling'],
		})
		const floor = screen.getByLabelText('Floor')

		await userEvent.click(floor)

		expect(floor).toBeDisabled()
		expect(floor).toBeChecked()
		expect(partConfig.updateComponent).not.toHaveBeenCalled()
	})

	it('writes a positive thickness', async () => {
		const partConfig = mountEditor()

		await enterNumber(thicknessField(), '35')

		const next: BoundsHint = { ...hint, wall_thickness_mm: 35 }
		expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
			attributes: { geometries: generateBoundsGeometries(next), extra: 'kept' },
			visualizer: next,
		})
	})

	it('reads the form from the walls of an obstacle stored without a hint, and writes one', async () => {
		const partConfig = mountEditor(hint, { isHintStored: false })

		await enterNumber(thicknessField(), '35')

		const next: BoundsHint = { ...hint, wall_thickness_mm: 35 }
		expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
			attributes: { geometries: generateBoundsGeometries(next), extra: 'kept' },
			visualizer: next,
		})
	})

	it('writes a thickness above 100 from a thinner wall', async () => {
		const thin: BoundsHint = { ...hint, wall_thickness_mm: 10 }
		const partConfig = mountEditor(thin)

		await enterNumber(thicknessField(), '250')

		const next: BoundsHint = { ...thin, wall_thickness_mm: 250 }
		expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
			attributes: { geometries: generateBoundsGeometries(next), extra: 'kept' },
			visualizer: next,
		})
	})
})

import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld, type Entity } from 'koota'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '#lib/__tests__/__fixtures__/partConfig.js'
import { relations, traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'
import * as usePartConfig from '#lib/hooks/usePartConfig.svelte.js'
import { createObstacleComponent } from '#lib/obstacle.js'
import { type ObstacleGeometryConfig } from '#lib/obstacleAttributes.js'

import DeleteObstacleShapeButton from '../DeleteObstacleShapeButton.svelte'

const threeShapes = (): ObstacleGeometryConfig[] => [
	{ label: 'a', type: 'box', x: 10, y: 20, z: 30 },
	{ label: 'b', type: 'sphere', r: 4 },
	{ label: 'c', type: 'box', x: 1, y: 2, z: 3 },
]

const world = createWorld()

let obstacle: Entity

beforeEach(() => {
	world.reset()
	obstacle = world.spawn(traits.Name('obstacle-1'))
})

const mountButton = (indices: number[], geometries: ObstacleGeometryConfig[] = threeShapes()) => {
	const component = createObstacleComponent('obstacle-1')
	component.attributes = { extra: 'kept', geometries }
	component.visualizer = { type: 'complex' }
	const partConfig = createPartConfigFixture({ current: { components: [component] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)
	const shapes = indices.map((index) => ({
		entity: world.spawn(
			traits.Name(`obstacle-1:${geometries[index]?.label}`),
			traits.Selected,
			relations.ChildOf(obstacle)
		),
		component,
		index,
	}))

	render(DeleteObstacleShapeButton, {
		props: { shapes },
		context: new Map([[WORLD_CONTEXT_KEY, world]]),
	})

	return { partConfig, shapes }
}

describe('DeleteObstacleShapeButton', () => {
	it('deletes the shape from its obstacle', async () => {
		const { partConfig } = mountButton([0])

		await userEvent.click(screen.getByRole('button', { name: 'Delete shape' }))

		expect(partConfig.updateComponents).toHaveBeenLastCalledWith(
			new Map([
				[
					'obstacle-1',
					{
						attributes: { extra: 'kept', geometries: threeShapes().slice(1) },
						visualizer: { type: 'complex' },
					},
				],
			])
		)
	})

	it('deletes several shapes of one obstacle in one write', async () => {
		const { partConfig } = mountButton([0, 2])

		await userEvent.click(screen.getByRole('button', { name: 'Delete 2 shapes' }))

		expect(partConfig.updateComponents).toHaveBeenCalledOnce()
		expect(partConfig.updateComponents).toHaveBeenLastCalledWith(
			new Map([
				[
					'obstacle-1',
					{
						attributes: { extra: 'kept', geometries: [{ label: 'b', type: 'sphere', r: 4 }] },
						visualizer: { type: 'complex' },
					},
				],
			])
		)
	})

	it('selects the obstacle in place of the deleted shape', async () => {
		mountButton([0])

		await userEvent.click(screen.getByRole('button', { name: 'Delete shape' }))

		expect([...world.query(traits.Selected)]).toEqual([obstacle])
	})

	it('cannot delete the last shape', async () => {
		const { partConfig, shapes } = mountButton([0], [{ label: 'a', type: 'box', x: 1, y: 1, z: 1 }])
		const deleteButton = screen.getByRole('button', { name: 'Delete shape' })

		expect(deleteButton).toHaveAttribute('aria-disabled', 'true')
		expect(deleteButton).toHaveAttribute('title', 'An obstacle needs at least one geometry')
		await userEvent.click(deleteButton)

		expect(partConfig.updateComponents).not.toHaveBeenCalled()
		expect(shapes[0]?.entity.has(traits.Selected)).toBe(true)
	})

	it('cannot delete every shape of an obstacle at once', () => {
		mountButton([0, 1, 2])

		expect(screen.getByRole('button', { name: 'Delete 3 shapes' })).toHaveAttribute(
			'aria-disabled',
			'true'
		)
	})
})

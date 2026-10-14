import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld, type Entity } from 'koota'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { relations, traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import { createObstacleComponent } from '$lib/obstacle'
import { type ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import RemoveObstacleShapeButton from '../RemoveObstacleShapeButton.svelte'

const twoShapes = (): ObstacleGeometryConfig[] => [
	{ label: 'a', type: 'box', x: 10, y: 20, z: 30 },
	{ label: 'b', type: 'sphere', r: 4 },
]

const world = createWorld()

let obstacle: Entity
let shape: Entity

beforeEach(() => {
	world.reset()
	obstacle = world.spawn(traits.Name('obstacle-1'))
	shape = world.spawn(traits.Name('obstacle-1:a'), traits.Selected, relations.ChildOf(obstacle))
})

const mountButton = (geometries: ObstacleGeometryConfig[] = twoShapes()) => {
	const component = createObstacleComponent('obstacle-1')
	component.attributes = { extra: 'kept', geometries }
	component.visualizer = { type: 'complex' }
	const partConfig = createPartConfigFixture({ current: { components: [component] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)

	render(RemoveObstacleShapeButton, {
		props: { entity: shape, component, index: 0 },
		context: new Map([[WORLD_CONTEXT_KEY, world]]),
	})

	return partConfig
}

describe('RemoveObstacleShapeButton', () => {
	it('removes the shape from its obstacle', async () => {
		const partConfig = mountButton()

		await userEvent.click(screen.getByRole('button', { name: 'Remove shape' }))

		expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
			attributes: { extra: 'kept', geometries: [{ label: 'b', type: 'sphere', r: 4 }] },
			visualizer: { type: 'complex' },
		})
	})

	it('selects the obstacle in place of the removed shape', async () => {
		mountButton()

		await userEvent.click(screen.getByRole('button', { name: 'Remove shape' }))

		expect([...world.query(traits.Selected)]).toEqual([obstacle])
	})

	it('cannot remove the last shape', async () => {
		const partConfig = mountButton([{ label: 'a', type: 'box', x: 1, y: 1, z: 1 }])
		const remove = screen.getByRole('button', { name: 'Remove shape' })

		expect(remove).toHaveAttribute('aria-disabled', 'true')
		expect(remove).toHaveAttribute('title', 'An obstacle needs at least one geometry')
		await userEvent.click(remove)

		expect(partConfig.updateComponent).not.toHaveBeenCalled()
		expect(shape.has(traits.Selected)).toBe(true)
	})
})

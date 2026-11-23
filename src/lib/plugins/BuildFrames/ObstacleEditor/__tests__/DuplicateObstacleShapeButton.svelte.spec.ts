import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld, type Entity } from 'koota'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '#lib/__tests__/__fixtures__/partConfig.js'
import { relations, traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'
import * as usePartConfig from '#lib/hooks/usePartConfig.svelte.js'
import { createKeybindings, KEYBINDINGS_CONTEXT_KEY } from '#lib/keybindings/index.js'
import { createObstacleComponent } from '#lib/obstacle.js'
import { type ObstacleGeometryConfig } from '#lib/obstacleAttributes.js'

import DuplicateObstacleShapeButton from '../DuplicateObstacleShapeButton.svelte'

const toast = vi.fn()

vi.mock('@viamrobotics/prime-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@viamrobotics/prime-core')>()),
	useToast: () => toast,
}))

const twoShapes = (): ObstacleGeometryConfig[] => [
	{ label: 'a', type: 'box', x: 10, y: 20, z: 30 },
	{ label: 'b', type: 'sphere', r: 4 },
]

const world = createWorld()

let obstacle: Entity

beforeEach(() => {
	world.reset()
	obstacle = world.spawn(traits.Name('obstacle-1'))
})

const mountButton = (indices: number[], geometries: ObstacleGeometryConfig[] = twoShapes()) => {
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

	render(DuplicateObstacleShapeButton, {
		props: { shapes },
		context: new Map<symbol, unknown>([
			[WORLD_CONTEXT_KEY, world],
			[KEYBINDINGS_CONTEXT_KEY, createKeybindings()],
		]),
	})

	return partConfig
}

const writtenGeometries = (partConfig: ReturnType<typeof createPartConfigFixture>) =>
	vi.mocked(partConfig.updateComponents).mock.lastCall?.[0].get('obstacle-1')?.attributes
		?.geometries

describe('DuplicateObstacleShapeButton', () => {
	it('appends a -copy of the shape to its obstacle', async () => {
		const partConfig = mountButton([0])

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate shape' }))

		expect(writtenGeometries(partConfig)).toEqual([
			...twoShapes(),
			{ label: 'a-copy', type: 'box', x: 10, y: 20, z: 30 },
		])
	})

	it('appends a copy of each selected shape in one write', async () => {
		const partConfig = mountButton([0, 1])

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate 2 shapes' }))

		expect(partConfig.updateComponents).toHaveBeenCalledOnce()
		expect(writtenGeometries(partConfig)).toEqual([
			...twoShapes(),
			{ label: 'a-copy', type: 'box', x: 10, y: 20, z: 30 },
			{ label: 'b-copy', type: 'sphere', r: 4 },
		])
	})

	it('names the source and its copy in a toast', async () => {
		mountButton([0])

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate shape' }))

		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({ message: 'Duplicated a as a-copy.' })
		)
	})

	it('counts several copies in a toast', async () => {
		mountButton([0, 1])

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate 2 shapes' }))

		expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Duplicated 2 shapes.' }))
	})

	it('selects the copies once their frames appear', async () => {
		mountButton([0, 1])
		await userEvent.click(screen.getByRole('button', { name: 'Duplicate 2 shapes' }))

		const copyA = world.spawn(traits.Name('obstacle-1:a-copy'), relations.ChildOf(obstacle))
		const copyB = world.spawn(traits.Name('obstacle-1:b-copy'), relations.ChildOf(obstacle))

		expect([...world.query(traits.Selected)]).toEqual([copyA, copyB])
	})

	it('shows the error and writes nothing for a copy rdk would reject', async () => {
		const partConfig = mountButton([0], [{ label: 'a', type: 'sphere', r: 0 }])

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate shape' }))

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'A sphere radius must be greater than zero.'
		)
		expect(partConfig.updateComponents).not.toHaveBeenCalled()
	})
})

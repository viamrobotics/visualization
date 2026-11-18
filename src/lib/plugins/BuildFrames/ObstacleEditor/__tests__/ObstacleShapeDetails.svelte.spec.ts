import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld, type Entity } from 'koota'
import { Matrix4 } from 'three'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { relations, traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import { createObstacleComponent } from '$lib/obstacle'
import { type ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import ObstacleShapeDetails from '../ObstacleShapeDetails.svelte'

const offset = { translation: { x: 5, y: 6, z: 7 } }

const defaultGeometries = (): ObstacleGeometryConfig[] => [
	{ label: 'a', type: 'box', x: 10, y: 20, z: 30, ...offset },
	{ label: 'b', type: 'box', x: 1, y: 2, z: 3 },
	{ type: 'sphere', r: 4 },
]

const world = createWorld()

let obstacle: Entity

beforeEach(() => {
	world.reset()
	obstacle = world.spawn(traits.Name('obstacle-1'))
})

const spawnShape = (name: string) =>
	world.spawn(
		traits.Name(name),
		traits.WorldMatrix(new Matrix4().makeTranslation(1, 0, 0)),
		traits.Center({ x: 250, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 }),
		relations.ChildOf(obstacle)
	)

const mountShape = (index = 0, geometries: ObstacleGeometryConfig[] = defaultGeometries()) => {
	const component = createObstacleComponent('obstacle-1')
	component.attributes = { extra: 'kept', geometries }
	component.visualizer = { type: 'complex' }
	const partConfig = createPartConfigFixture({ current: { components: [component] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)

	render(ObstacleShapeDetails, {
		props: { entity: spawnShape(`obstacle-1:shape-${index}`), component, index },
		context: new Map([[WORLD_CONTEXT_KEY, world]]),
	})

	return partConfig
}

describe('ObstacleShapeDetails', () => {
	it('places the shape in the world by its offset from the obstacle', () => {
		mountShape()

		expect(screen.getByText('1250.00')).toBeInTheDocument()
	})

	it('links to the obstacle as the parent frame', () => {
		mountShape()

		expect(screen.getByRole('button', { name: 'Select obstacle-1' })).toBeInTheDocument()
	})

	it.each([
		['a duplicate label', 'b', 'The label "b" is used more than once.'],
		['the reserved label', 'world', 'The label "world" is reserved.'],
		['a label with a colon', 'x:y', 'A label cannot contain ":".'],
	])('shows the error and writes nothing for %s', async (_name, next, message) => {
		const partConfig = mountShape()
		const input = screen.getByLabelText('label')

		await userEvent.tripleClick(input)
		await userEvent.keyboard(`${next}{Enter}`)

		expect(await screen.findByRole('alert')).toHaveTextContent(message)
		expect(input).toHaveAttribute('aria-invalid', 'true')
		expect(input).toHaveAccessibleDescription(message)
		expect(partConfig.updateComponent).not.toHaveBeenCalled()
	})

	it('clears a label error once the shape is given its label back', async () => {
		mountShape()
		const input = screen.getByLabelText('label')
		await userEvent.tripleClick(input)
		await userEvent.keyboard('b{Enter}')

		await userEvent.tripleClick(input)
		await userEvent.keyboard('a{Enter}')

		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(input).not.toHaveAttribute('aria-invalid')
	})

	it('writes a valid relabel', async () => {
		const partConfig = mountShape()

		await userEvent.tripleClick(screen.getByLabelText('label'))
		await userEvent.keyboard('root{Enter}')

		expect(partConfig.updateComponent).toHaveBeenCalledTimes(1)
		expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
			attributes: {
				extra: 'kept',
				geometries: [{ ...defaultGeometries()[0], label: 'root' }, ...defaultGeometries().slice(1)],
			},
			visualizer: { type: 'complex' },
		})
	})

	it('moves the selection to the frame a relabel renames the shape to', async () => {
		mountShape()

		await userEvent.tripleClick(screen.getByLabelText('label'))
		await userEvent.keyboard('root{Enter}')
		const renamed = world.spawn(traits.Name('obstacle-1:root'))

		expect(renamed.has(traits.Selected)).toBe(true)
	})

	it('writes the entry without a label when the label is cleared', async () => {
		const partConfig = mountShape()

		await userEvent.tripleClick(screen.getByLabelText('label'))
		await userEvent.keyboard('{Backspace}{Enter}')

		const { attributes } = vi.mocked(partConfig.updateComponent).mock.lastCall![1]
		const written = attributes!.geometries as ObstacleGeometryConfig[]
		expect(written[0]).toEqual({ type: 'box', x: 10, y: 20, z: 30, ...offset })
		expect('label' in written[0]!).toBe(false)
	})

	it('keeps the label and offset when the shape changes', async () => {
		const partConfig = mountShape()

		await userEvent.click(screen.getByText('Sphere'))

		await vi.waitFor(() =>
			expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
				attributes: {
					extra: 'kept',
					geometries: [
						{ label: 'a', type: 'sphere', r: 100, ...offset },
						...defaultGeometries().slice(1),
					],
				},
				visualizer: { type: 'complex' },
			})
		)
	})

	it('writes an offset change to this shape only', async () => {
		const partConfig = mountShape(1)
		const x = screen
			.getByLabelText('mutable local position')
			.querySelector<HTMLInputElement>('.tp-pndtxtv input')!

		await userEvent.tripleClick(x)
		await userEvent.keyboard('42{Tab}')

		await vi.waitFor(() => expect(partConfig.updateComponent).toHaveBeenCalled())
		const { attributes } = vi.mocked(partConfig.updateComponent).mock.lastCall![1]
		const written = attributes!.geometries as ObstacleGeometryConfig[]
		expect(written[0]).toEqual(defaultGeometries()[0])
		expect(written[1]?.translation).toMatchObject({ x: 42 })
		expect(partConfig.updateFrame).not.toHaveBeenCalled()
	})

	it('lists a stored problem with this shape', () => {
		mountShape(0, [{ type: 'sphere', r: 0 }])

		expect(screen.getByLabelText('existing shape problems')).toHaveTextContent(
			'A sphere radius must be greater than zero.'
		)
	})
})

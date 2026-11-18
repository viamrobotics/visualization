import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import { createObstacleComponent } from '$lib/obstacle'
import { type ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import ObstacleEditor from '../ObstacleEditor.svelte'

const offset = { translation: { x: 5, y: 6, z: 7 } }

const defaultGeometries = (): ObstacleGeometryConfig[] => [
	{ label: 'a', type: 'box', x: 10, y: 20, z: 30, ...offset },
	{ label: 'b', type: 'box', x: 1, y: 2, z: 3 },
	{ type: 'sphere', r: 4 },
]

const world = createWorld()

beforeEach(() => {
	world.reset()
})

const mountEditor = (geometries: ObstacleGeometryConfig[] = defaultGeometries()) => {
	const component = createObstacleComponent('obstacle-1')
	component.attributes = { extra: 'kept', geometries }
	component.visualizer = { type: 'complex' }
	const partConfig = createPartConfigFixture({ current: { components: [component] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)

	render(ObstacleEditor, {
		props: { name: 'obstacle-1' },
		context: new Map([[WORLD_CONTEXT_KEY, world]]),
	})

	return partConfig
}

describe('ComplexObstacleEditor', () => {
	it('lists every shape by its label', () => {
		mountEditor()

		expect(screen.getByLabelText('obstacle geometries')).toBeInTheDocument()
		expect(screen.getByLabelText('Shape 1 label')).toHaveValue('a')
		expect(screen.getByLabelText('Shape 2 label')).toHaveValue('b')
	})

	it('shows an unlabeled shape by the name rdk gives it', () => {
		mountEditor()

		expect(screen.getByLabelText('Shape 3 label')).toHaveValue('')
		expect(screen.getByLabelText('Shape 3 label')).toHaveAttribute('placeholder', 'geometry_2')
		expect(screen.getByRole('button', { name: 'Select geometry_2' })).toBeInTheDocument()
	})

	it('offers no pose or geometry fields, which belong to a selected shape', () => {
		mountEditor()

		expect(screen.queryByLabelText('mutable local position')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('mutable geometry')).not.toBeInTheDocument()
	})

	it('writes a valid relabel from the row', async () => {
		const partConfig = mountEditor()

		await userEvent.tripleClick(screen.getByLabelText('Shape 2 label'))
		await userEvent.keyboard('post{Enter}')

		expect(partConfig.updateComponent).toHaveBeenCalledTimes(1)
		expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
			attributes: {
				extra: 'kept',
				geometries: [
					defaultGeometries()[0],
					{ ...defaultGeometries()[1], label: 'post' },
					defaultGeometries()[2],
				],
			},
			visualizer: { type: 'complex' },
		})
	})

	it('writes the entry without a label when its row is cleared', async () => {
		const partConfig = mountEditor()

		await userEvent.tripleClick(screen.getByLabelText('Shape 1 label'))
		await userEvent.keyboard('{Backspace}{Enter}')

		const { attributes } = vi.mocked(partConfig.updateComponent).mock.lastCall![1]
		const written = attributes!.geometries as ObstacleGeometryConfig[]
		expect(written[0]).toEqual({ type: 'box', x: 10, y: 20, z: 30, ...offset })
	})

	it.each([
		['a duplicate label', 'b', 'The label "b" is used more than once.'],
		['the reserved label', 'world', 'The label "world" is reserved.'],
		['a label with a colon', 'x:y', 'A label cannot contain ":".'],
	])('shows the error on the row and writes nothing for %s', async (_name, next, message) => {
		const partConfig = mountEditor()
		const input = screen.getByLabelText('Shape 1 label')

		await userEvent.tripleClick(input)
		await userEvent.keyboard(`${next}{Enter}`)

		expect(await screen.findByRole('alert')).toHaveTextContent(message)
		expect(input).toHaveAttribute('aria-invalid', 'true')
		expect(input).toHaveAccessibleDescription(message)
		expect(partConfig.updateComponent).not.toHaveBeenCalled()
	})

	it('clears a label error once the row is given its label back', async () => {
		mountEditor()
		const input = screen.getByLabelText('Shape 1 label')
		await userEvent.tripleClick(input)
		await userEvent.keyboard('b{Enter}')

		await userEvent.tripleClick(input)
		await userEvent.keyboard('a{Enter}')

		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(input).not.toHaveAttribute('aria-invalid')
	})

	it('adds a default box shape', async () => {
		const partConfig = mountEditor()

		await userEvent.click(screen.getByRole('button', { name: 'Add shape' }))

		const { attributes, visualizer } = vi.mocked(partConfig.updateComponent).mock.lastCall![1]
		expect(attributes).toMatchObject({ extra: 'kept' })
		expect(visualizer).toEqual({ type: 'complex' })
		const written = attributes!.geometries as ObstacleGeometryConfig[]
		expect(written).toHaveLength(4)
		expect(written[3]).toMatchObject({ label: 'shape-1', type: 'box' })
	})

	it('removes the shape in the row', async () => {
		const partConfig = mountEditor()

		await userEvent.click(screen.getByRole('button', { name: 'Remove b' }))

		expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
			attributes: { extra: 'kept', geometries: [defaultGeometries()[0], defaultGeometries()[2]] },
			visualizer: { type: 'complex' },
		})
	})

	it('cannot remove the last shape', async () => {
		const partConfig = mountEditor([{ label: 'only', type: 'box', x: 1, y: 1, z: 1 }])
		const remove = screen.getByRole('button', { name: 'Remove only' })

		expect(remove).toHaveAttribute('aria-disabled', 'true')
		expect(remove).toHaveAttribute('title', 'An obstacle needs at least one geometry')
		await userEvent.click(remove)

		expect(partConfig.updateComponent).not.toHaveBeenCalled()
	})

	it('moves the selection to the shape picked from its row', async () => {
		const obstacle = world.spawn(traits.Name('obstacle-1'), traits.Selected)
		world.spawn(traits.Name('obstacle-1:a'), traits.ComplexObstacleShape({ index: 0 }))
		const shapeB = world.spawn(
			traits.Name('obstacle-1:b'),
			traits.ComplexObstacleShape({ index: 1 })
		)
		mountEditor()

		await userEvent.click(screen.getByRole('button', { name: 'Select b' }))

		expect([...world.query(traits.Selected)]).toEqual([shapeB])
		expect(obstacle.has(traits.Selected)).toBe(false)
	})

	it('lists the problems of stored geometries', () => {
		mountEditor([{ type: 'sphere', r: 0 }])

		expect(screen.getByLabelText('existing geometry problems')).toHaveTextContent(
			'A sphere radius must be greater than zero.'
		)
	})
})

import { createWorld, type Entity, type World } from 'koota'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(() => Promise.resolve({ positions: new Float32Array(), colors: null })),
}))

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

import { FrameEditor } from '../FrameEditor'

type Mutation = (editor: FrameEditor, entity: Entity) => void

/**
 * Named for a kinematics-derived link, the case this guards: it reaches the
 * scene without `Editable`, and there is no `components.arm-1:base` to write to.
 */
const spawnFrame = (world: World, editable: boolean) =>
	world.spawn(
		traits.Name('arm-1:base'),
		traits.FramesAPI,
		traits.Matrix(new Pose().toMatrix4()),
		traits.Box({ x: 1, y: 2, z: 3 }),
		...(editable ? [traits.Editable] : [])
	)

const mutations: [string, Mutation][] = [
	['setPose', (editor, entity) => editor.setPose(entity, { x: 5 })],
	['setParent', (editor, entity) => editor.setParent(entity, 'world')],
	['setGeometry', (editor, entity) => editor.setGeometry(entity, { type: 'box', x: 9 })],
	['setGeometryType', (editor, entity) => editor.setGeometryType(entity, 'sphere')],
]

describe('FrameEditor', () => {
	let world: World

	afterEach(() => {
		world?.destroy()
	})

	const setup = (editable: boolean) => {
		world = createWorld()
		const updateFrame = vi.fn()
		const deleteFrame = vi.fn()

		return {
			entity: spawnFrame(world, editable),
			updateFrame,
			deleteFrame,
			editor: new FrameEditor(updateFrame, deleteFrame),
		}
	}

	describe('without Editable', () => {
		it.each(mutations)('%s writes nothing to the config', (_name, mutate) => {
			const { editor, entity, updateFrame } = setup(false)

			mutate(editor, entity)

			expect(updateFrame).not.toHaveBeenCalled()
		})

		it('deleteFrame removes nothing', () => {
			const { editor, entity, deleteFrame } = setup(false)

			editor.deleteFrame(entity)

			expect(deleteFrame).not.toHaveBeenCalled()
		})

		// Staging would leave the frame visibly moved with nothing dirtied.
		it('stages no EditedMatrix', () => {
			const { editor, entity } = setup(false)

			editor.setPose(entity, { x: 5 })

			expect(entity.has(traits.EditedMatrix)).toBe(false)
		})
	})

	// Guards against the suite passing because every mutator is inert.
	describe('with Editable', () => {
		it('setPose writes the config and stages the edit', () => {
			const { editor, entity, updateFrame } = setup(true)

			editor.setPose(entity, { x: 5 })

			expect(updateFrame).toHaveBeenCalledOnce()
			expect(entity.has(traits.EditedMatrix)).toBe(true)
		})

		it('deleteFrame reaches the config', () => {
			const { editor, entity, deleteFrame } = setup(true)

			editor.deleteFrame(entity)

			expect(deleteFrame).toHaveBeenCalledWith('arm-1:base')
		})
	})
})

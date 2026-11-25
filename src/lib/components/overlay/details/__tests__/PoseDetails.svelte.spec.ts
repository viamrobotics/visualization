import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'
import { Pose } from '#lib/math/index.js'

import PoseDetails from '../PoseDetails.svelte'

describe('PoseDetails', () => {
	const world = createWorld()

	it('always renders parent, world position, and world orientation sections', () => {
		const entity = world.spawn()
		render(PoseDetails, {
			props: { entities: [entity] },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByText('parent frame')).toBeInTheDocument()
		expect(screen.getByText('world position')).toBeInTheDocument()
		expect(screen.getByText('world orientation')).toBeInTheDocument()
	})

	it('folds a drawn geometry center into the local and world poses', () => {
		const identity = new Pose().toMatrix4()
		const entity = world.spawn(
			traits.Matrix(identity),
			traits.WorldMatrix(identity.clone()),
			traits.Center({ x: 100, y: 200, z: 300, oX: 0, oY: 0, oZ: 1, theta: 0 })
		)
		render(PoseDetails, {
			props: { entities: [entity] },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		expect(
			screen.getByLabelText('immutable local position x coordinate').parentElement
		).toHaveTextContent('100.00')
		expect(screen.getByText('world position').parentElement).toHaveTextContent(
			'x 100.00 y 200.00 z 300.00'
		)
	})

	it('keeps a reference frame pose separate from its geometry center', () => {
		const identity = new Pose().toMatrix4()
		const entity = world.spawn(
			traits.Matrix(identity),
			traits.WorldMatrix(identity.clone()),
			traits.Center({ x: 100, y: 200, z: 300, oX: 0, oY: 0, oZ: 1, theta: 0 }),
			traits.FramesAPI
		)
		render(PoseDetails, {
			props: { entities: [entity] },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		expect(
			screen.getByLabelText('immutable local position x coordinate').parentElement
		).toHaveTextContent('0.00')
		expect(screen.getByText('world position').parentElement).toHaveTextContent(
			'x 0.00 y 0.00 z 0.00'
		)
	})

	it('reads an entity with no matrix or center as the origin, where it renders', () => {
		const entity = world.spawn()
		render(PoseDetails, {
			props: { entities: [entity] },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(
			screen.getByLabelText('immutable local position x coordinate').parentElement
		).toHaveTextContent('0.00')
		expect(
			screen.getByLabelText('immutable local orientation z coordinate').parentElement
		).toHaveTextContent('1.00')
	})

	it('shows the world pose as dashes when only some selected entities have a world transform', () => {
		const identity = new Pose().toMatrix4()
		const placed = world.spawn(traits.Matrix(identity), traits.WorldMatrix(identity.clone()))
		const unresolved = world.spawn(traits.Matrix(identity.clone()))
		render(PoseDetails, {
			props: { entities: [placed, unresolved] },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByText('world position').parentElement).toHaveTextContent('x - y - z -')
	})

	it('shows a dash for an axis the selected entities differ on, and the shared value otherwise', () => {
		const first = world.spawn(traits.Matrix(new Pose(100, 50, 0).toMatrix4()))
		const second = world.spawn(traits.Matrix(new Pose(200, 50, 0).toMatrix4()))
		render(PoseDetails, {
			props: { entities: [first, second] },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(
			screen.getByLabelText('immutable local position x coordinate').parentElement
		).toHaveTextContent('-')
		expect(
			screen.getByLabelText('immutable local position y coordinate').parentElement
		).toHaveTextContent('50.00')
	})
})

import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import GeometryDetails from '../GeometryDetails.svelte'

describe('GeometryDetails', () => {
	const world = createWorld()

	it('renders box dimensions when entity has Box trait', () => {
		const entity = world.spawn(traits.Box({ x: 10, y: 20, z: 30 }))
		render(GeometryDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByLabelText('mutable box dimensions')).toBeInTheDocument()
	})

	it('renders sphere dimensions when entity has Sphere trait', () => {
		const entity = world.spawn(traits.Sphere({ r: 50 }))
		render(GeometryDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByLabelText('mutable sphere dimensions')).toBeInTheDocument()
	})

	it('renders capsule dimensions when entity has Capsule trait', () => {
		const entity = world.spawn(traits.Capsule({ r: 25, l: 100 }))
		render(GeometryDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByLabelText('mutable capsule dimensions')).toBeInTheDocument()
	})

	it('renders nothing when entity has no geometry trait', () => {
		const entity = world.spawn()
		render(GeometryDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.queryByText('dimensions')).not.toBeInTheDocument()
	})
})

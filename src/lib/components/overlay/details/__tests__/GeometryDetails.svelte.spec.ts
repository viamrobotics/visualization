import { screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { renderWithWorld } from '$lib/__tests__/__fixtures__/renderWithWorld'
import { traits } from '$lib/ecs'

import GeometryDetails from '../GeometryDetails.svelte'

describe('GeometryDetails', () => {
	const world = createWorld()

	it('renders box dimensions when entity has Box trait', () => {
		const entity = world.spawn(traits.Box({ x: 10, y: 20, z: 30 }))
		renderWithWorld(GeometryDetails, {
			world,
			props: { entity },
		})
		expect(screen.getByLabelText('mutable box dimensions')).toBeInTheDocument()
	})

	it('renders sphere dimensions when entity has Sphere trait', () => {
		const entity = world.spawn(traits.Sphere({ r: 50 }))
		renderWithWorld(GeometryDetails, {
			world,
			props: { entity },
		})
		expect(screen.getByLabelText('mutable sphere dimensions')).toBeInTheDocument()
	})

	it('renders capsule dimensions when entity has Capsule trait', () => {
		const entity = world.spawn(traits.Capsule({ r: 25, l: 100 }))
		renderWithWorld(GeometryDetails, {
			world,
			props: { entity },
		})
		expect(screen.getByLabelText('mutable capsule dimensions')).toBeInTheDocument()
	})

	it('renders nothing when entity has no geometry trait', () => {
		const entity = world.spawn()
		renderWithWorld(GeometryDetails, {
			world,
			props: { entity },
		})
		expect(screen.queryByText('dimensions')).not.toBeInTheDocument()
	})
})

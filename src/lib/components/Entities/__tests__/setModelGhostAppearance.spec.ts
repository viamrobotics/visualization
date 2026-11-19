import { isInstanceOf } from '@threlte/core/webgpu'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setModelGhostAppearance } from '../setModelGhostAppearance'

beforeEach(() => {
	vi.mocked(isInstanceOf).mockImplementation(
		(object, type) => (object as Record<string, unknown>)[`is${type}`] === true
	)
})

const GHOST_GREEN = { r: 0.2, g: 0.6, b: 0.4 }

const loadedLink = () => {
	const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: new Texture() }))
	return { model: new Group().add(mesh), mesh }
}

describe('setModelGhostAppearance', () => {
	it('paints the model flat, dropping the texture that would darken the tint', () => {
		const { model, mesh } = loadedLink()

		setModelGhostAppearance(model, GHOST_GREEN)

		const material = mesh.material as MeshStandardMaterial
		expect(material.map).toBeNull()
		expect(material.color.toArray()).toEqual([0.2, 0.6, 0.4])
	})
})

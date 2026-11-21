import { isInstanceOf } from '@threlte/core/webgpu'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setModelDimmed } from '../setModelDimmed'

beforeEach(() => {
	vi.mocked(isInstanceOf).mockImplementation(
		(object, type) => (object as Record<string, unknown>)[`is${type}`] === true
	)
})

const RED_HEX = 0xff0000
const DIMMED_RED = [0.77917, 0.28236, 0.30191]

const redMesh = () => new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: RED_HEX }))

describe('setModelDimmed', () => {
	it('blends the material color halfway toward gray-5', () => {
		const mesh = redMesh()

		setModelDimmed(new Group().add(mesh), true)

		const color = (mesh.material as MeshStandardMaterial).color
		expect(color.r).toBeCloseTo(DIMMED_RED[0], 4)
		expect(color.g).toBeCloseTo(DIMMED_RED[1], 4)
		expect(color.b).toBeCloseTo(DIMMED_RED[2], 4)
	})

	it('restores the exact original color', () => {
		const mesh = redMesh()
		const model = new Group().add(mesh)
		const original = (mesh.material as MeshStandardMaterial).color.toArray()

		setModelDimmed(model, true)
		setModelDimmed(model, false)

		expect((mesh.material as MeshStandardMaterial).color.toArray()).toEqual(original)
	})

	it('blends once however many times it is dimmed', () => {
		const once = redMesh()
		const thrice = redMesh()

		setModelDimmed(new Group().add(once), true)
		const model = new Group().add(thrice)
		setModelDimmed(model, true)
		setModelDimmed(model, true)
		setModelDimmed(model, true)

		expect((thrice.material as MeshStandardMaterial).color.toArray()).toEqual(
			(once.material as MeshStandardMaterial).color.toArray()
		)
	})

	it('restores to the original after repeated dims', () => {
		const mesh = redMesh()
		const model = new Group().add(mesh)

		setModelDimmed(model, true)
		setModelDimmed(model, true)
		setModelDimmed(model, false)

		expect((mesh.material as MeshStandardMaterial).color.getHex()).toBe(RED_HEX)
	})

	it('leaves restoring an undimmed model as a no-op', () => {
		const mesh = redMesh()

		setModelDimmed(new Group().add(mesh), false)

		expect((mesh.material as MeshStandardMaterial).color.getHex()).toBe(RED_HEX)
	})

	it('dims every material of a multi-material mesh and restores each', () => {
		const first = new MeshStandardMaterial({ color: RED_HEX })
		const second = new MeshStandardMaterial({ color: 0x0000ff })
		const model = new Group().add(new Mesh(new BoxGeometry(), [first, second]))

		setModelDimmed(model, true)
		const dimmedHexes = [first.color.getHex(), second.color.getHex()]
		setModelDimmed(model, false)

		expect(dimmedHexes).not.toEqual([RED_HEX, 0x0000ff])
		expect([first.color.getHex(), second.color.getHex()]).toEqual([RED_HEX, 0x0000ff])
	})
})

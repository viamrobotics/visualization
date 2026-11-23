import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { scaledGeometry, scaleHandles } from '../gizmoScale'

const UNTURNED = new Quaternion()
const TURNED = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4)

const box = { type: 'box', x: 100, y: 200, z: 300 } as const
const capsule = { type: 'capsule', r: 10, l: 50 } as const

describe('scaleHandles', () => {
	it.each([
		{
			name: 'boxes facing the same way get a handle per axis',
			geometries: [box, box],
			orientations: [UNTURNED, UNTURNED],
			expected: { showY: true, showZ: true, isUniform: false },
		},
		{
			name: 'boxes facing different ways get only the uniform handle',
			geometries: [box, box],
			orientations: [UNTURNED, TURNED],
			expected: { showY: false, showZ: false, isUniform: true },
		},
		{
			name: 'a box and a capsule get only the uniform handle',
			geometries: [box, capsule],
			orientations: [UNTURNED, UNTURNED],
			expected: { showY: false, showZ: false, isUniform: true },
		},
		{
			name: 'one turned box keeps its handle per axis',
			geometries: [box],
			orientations: [TURNED],
			expected: { showY: true, showZ: true, isUniform: false },
		},
		{
			name: 'capsules facing the same way get radius and length handles',
			geometries: [capsule, capsule],
			orientations: [UNTURNED, UNTURNED],
			expected: { showY: true, showZ: false, isUniform: false },
		},
	])('$name', ({ geometries, orientations, expected }) => {
		expect(scaleHandles(geometries, orientations)).toEqual(expected)
	})
})

describe('scaledGeometry', () => {
	it('scales every capsule dimension by the x factor when uniform', () => {
		expect(scaledGeometry(capsule, new Vector3(2, 5, 1), true)).toEqual({
			type: 'capsule',
			r: 20,
			l: 100,
		})
	})

	it('scales each box dimension by its own axis factor', () => {
		expect(scaledGeometry(box, new Vector3(2, 0.5, 1), false)).toEqual({
			type: 'box',
			x: 200,
			y: 100,
			z: 300,
		})
	})

	it('clamps a negative factor, from dragging past the origin, at zero', () => {
		expect(scaledGeometry({ type: 'sphere', r: 10 }, new Vector3(-1, 1, 1), true)).toEqual({
			type: 'sphere',
			r: 0,
		})
	})
})

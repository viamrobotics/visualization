import { Matrix4, PerspectiveCamera, Scene, Vector3 } from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { TransformGizmoAnchor } from '../TransformGizmoAnchor'

const SNAP_STEP = 0.1

let controls: TransformControls
let anchor: TransformGizmoAnchor

// The types declare a PointerEvent, but these methods take the normalized pointer TransformControls builds.
const normalizedPointer = (x: number, button: number) =>
	({ x, y: 0, button }) as unknown as PointerEvent

const dragAlongX = (from: number, to: number) => {
	controls.axis = 'X'
	controls.pointerDown(normalizedPointer(from, 0))
	controls.pointerMove(normalizedPointer(to, -1))
	controls.pointerUp(normalizedPointer(to, 0))
}

beforeEach(() => {
	const camera = new PerspectiveCamera(50, 1, 0.1, 100)
	camera.position.set(0, -10, 0)
	camera.up.set(0, 0, 1)
	camera.lookAt(0, 0, 0)
	camera.updateMatrixWorld()

	const scene = new Scene()
	anchor = new TransformGizmoAnchor()
	scene.add(anchor)

	controls = new TransformControls(camera, document.createElement('div'))
	scene.add(controls.getHelper())
	controls.attach(anchor)
	controls.space = 'world'
	controls.translationSnap = SNAP_STEP
	controls.getHelper().updateMatrixWorld()
})

afterEach(() => {
	controls.dispose()
})

describe('TransformGizmoAnchor', () => {
	it('places itself at the world matrix it syncs to', () => {
		anchor.syncTo(new Matrix4().makeTranslation(0.25, 0.5, 0.75))

		expect(anchor.getWorldPosition(new Vector3()).toArray()).toEqual([0.25, 0.5, 0.75])
	})

	it('moves by a whole snap step on a world-space snapped drag', () => {
		anchor.syncTo(new Matrix4())

		dragAlongX(0, 0.2)

		expect(anchor.position.x).toBeGreaterThanOrEqual(SNAP_STEP)
		expect(Math.round(anchor.position.x / SNAP_STEP) * SNAP_STEP).toBeCloseTo(anchor.position.x)
	})

	it('keeps moving on a second snapped drag along the same axis', () => {
		anchor.syncTo(new Matrix4())
		dragAlongX(0, 0.2)
		const afterFirst = anchor.position.x
		anchor.syncTo(anchor.matrixWorld.clone())

		dragAlongX(0, 0.2)

		expect(anchor.position.x).toBeGreaterThan(afterFirst)
	})
})

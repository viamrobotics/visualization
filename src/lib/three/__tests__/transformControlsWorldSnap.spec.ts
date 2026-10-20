import { Group, type Matrix4, PerspectiveCamera, Scene } from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SNAP_STEP = 0.1

let controls: TransformControls
let anchor: Group

// The types declare a PointerEvent, but these methods take the normalized pointer TransformControls builds.
const normalizedPointer = (x: number, button: number) =>
	({ x, y: 0, button }) as unknown as PointerEvent

const dragAlongX = (from: number, to: number) => {
	controls.axis = 'X'
	controls.pointerDown(normalizedPointer(from, 0))
	controls.pointerMove(normalizedPointer(to, -1))
	controls.pointerUp(normalizedPointer(to, 0))
}

// Mirrors the $effect.pre in SelectedTransformControls that drives the gizmo anchor from the WorldMatrix trait.
const syncAnchor = (world: Matrix4) => {
	world.decompose(anchor.position, anchor.quaternion, anchor.scale)
	anchor.updateMatrixWorld()
}

beforeEach(() => {
	const camera = new PerspectiveCamera(50, 1, 0.1, 100)
	camera.position.set(0, -10, 0)
	camera.up.set(0, 0, 1)
	camera.lookAt(0, 0, 0)
	camera.updateMatrixWorld()

	const scene = new Scene()
	anchor = new Group()
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

describe('TransformControls world-space snapping on the gizmo anchor', () => {
	it('moves by a whole snap step on a snapped drag', () => {
		dragAlongX(0, 0.2)

		expect(anchor.position.x).toBeGreaterThanOrEqual(SNAP_STEP)
		expect(Math.round(anchor.position.x / SNAP_STEP) * SNAP_STEP).toBeCloseTo(anchor.position.x)
	})

	it('keeps moving on a second snapped drag along the same axis', () => {
		dragAlongX(0, 0.2)
		const afterFirst = anchor.position.x
		syncAnchor(anchor.matrixWorld.clone())

		dragAlongX(0, 0.2)

		expect(anchor.position.x).toBeGreaterThan(afterFirst)
	})
})

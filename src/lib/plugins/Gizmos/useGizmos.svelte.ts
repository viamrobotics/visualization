import { getContext, setContext } from 'svelte'
import { Vector3 } from 'three'

import { traits } from '$lib/ecs'

import type {
	ArrowAxis,
	GeometryPlacement,
	GizmoMode,
	LineMeasure,
	LineSpace,
	PlaneAxis,
	PlanePlacement,
	ReferenceShape,
} from './gizmos'

const key = Symbol('gizmos-plugin-context')

const planeNormalForAxis = {
	yz: new Vector3(1, 0, 0),
	xz: new Vector3(0, 1, 0),
	xy: new Vector3(0, 0, 1),
} as const satisfies Record<PlaneAxis, Vector3>

/**
 * Reference solids match the core geometry-trait defaults, so a gizmo the user
 * places and a bare `traits.Box` agree on size.
 */
const geometryTraits = {
	box: traits.Box({ x: 200, y: 200, z: 200 }),
	sphere: traits.Sphere({ r: 200 }),
	capsule: traits.Capsule({ l: 200, r: 50 }),
} as const

/**
 * The `Gizmos` plugin's published state: which tool is armed, the options that
 * tool reads, and the action that disarms it. Getters, not values, so
 * reactivity survives the context boundary.
 *
 * @param exit Disarms the active tool and hands the pointer back to the camera.
 */
export const provideGizmos = (exit: () => void) => {
	let mode = $state<GizmoMode>('idle')

	let planeAxis = $state<PlaneAxis>('xy')
	let planePlacement = $state<PlanePlacement>('free')
	let planeOffset = $state(0)

	let referenceShape = $state<ReferenceShape>('box')
	let geometryPlacement = $state<GeometryPlacement>('free')
	let isWireframe = $state(false)

	let lineSpace = $state<LineSpace>('world')
	let lineMeasure = $state<LineMeasure>('none')

	let arrowAxis = $state<ArrowAxis>('z')

	return setContext(key, {
		get mode() {
			return mode
		},
		set mode(value) {
			mode = value
		},

		get planeAxis() {
			return planeAxis
		},
		set planeAxis(value) {
			planeAxis = value
		},

		get planePlacement() {
			return planePlacement
		},
		set planePlacement(value) {
			planePlacement = value
		},

		/** Distance along the plane's normal, in mm, when `planePlacement` is `offset`. */
		get planeOffset() {
			return planeOffset
		},
		set planeOffset(value) {
			planeOffset = value
		},

		/** A fresh vector each read, so a caller may mutate it freely. */
		get planeAxisVector() {
			return planeNormalForAxis[planeAxis].clone()
		},

		get referenceShape() {
			return referenceShape
		},
		set referenceShape(value) {
			referenceShape = value
		},

		get geometryPlacement() {
			return geometryPlacement
		},
		set geometryPlacement(value) {
			geometryPlacement = value
		},

		/** The geometry trait for the selected solid, or `undefined` for a plane. */
		get geometryTrait() {
			return referenceShape === 'plane' ? undefined : geometryTraits[referenceShape]
		},

		get isWireframe() {
			return isWireframe
		},
		set isWireframe(value) {
			isWireframe = value
		},

		get lineSpace() {
			return lineSpace
		},
		set lineSpace(value) {
			lineSpace = value
		},

		get lineMeasure() {
			return lineMeasure
		},
		set lineMeasure(value) {
			lineMeasure = value
		},

		get arrowAxis() {
			return arrowAxis
		},
		set arrowAxis(value) {
			arrowAxis = value
		},

		exit,
	})
}

export const useGizmos = () => {
	return getContext<ReturnType<typeof provideGizmos>>(key)
}

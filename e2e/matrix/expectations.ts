import { Matrix4 } from 'three'

import type { DraftPose } from '../../src/lib/__tests__/__fixtures__/entityDrafts'
import type { EntityTypeDescriptor } from '../../src/lib/__tests__/__fixtures__/entityMatrix'
import type { ExpectedEntityState } from './entityState'

import {
	DOT_COLORS,
	DOT_SIZE,
	HALF_OPACITY,
	LINE_WIDTH,
	MOVED_POSE,
	OFFSET_CENTER,
	PARENT_FRAME,
	POINT_SIZE,
	ROTATED_POSE,
	UNIFORM_COLOR,
	VERTEX_COLORS,
} from '../../src/lib/__tests__/__fixtures__/entityMatrix'
import { Pose } from '../../src/lib/math'
import { PARENT_POSE } from './drafts'

/**
 * Types a per-entity renderer mounts an `Object3D` for, which is what makes an
 * `object3d.visible` assertion meaningful. Frames render through the shared
 * axes batch, models mount their `Object3D` on a child entity, and the
 * instanced types have none at all.
 */
const HAS_OBJECT3D = new Set(['mesh', 'points', 'pcd', 'line', 'nurbs', 'arrows'])

/**
 * Types that mount no `Object3D` to inspect but still put pixels on the canvas,
 * so a visibility case can be proved against the empty-scene frame instead. The
 * instanced shapes are the whole set: every other pixel-drawing type is in
 * `HAS_OBJECT3D`, and the types that draw nothing are recorded in
 * `entity-appearance.test.ts`.
 */
const CANVAS_PROOF_TYPES = new Set(['box', 'sphere', 'capsule'])

export interface CellExpectation {
	/** Trait state the cell must converge to, matched with `toMatchObject`. */
	state: ExpectedEntityState
	/**
	 * Whether the settled canvas must be byte-identical to the empty-scene frame.
	 * The only visibility proof available for a type that draws pixels but mounts
	 * no `Object3D`: its renderer reads `InheritedInvisible` into a shared buffer
	 * that nothing outside the component can address.
	 */
	canvas?: 'blank' | 'drawn'
}

const round = (value: number) => Math.round(value * 1e6) / 1e6 || 0

const matrixOf = ({ x, y, z, oX, oY, oZ, theta }: DraftPose): number[] => [
	...new Pose(x, y, z, oX, oY, oZ, theta).toMatrix4().elements,
]

const localMatrix = (pose: DraftPose): number[] => matrixOf(pose).map((value) => round(value))

const composedTranslation = (parent: DraftPose, child: DraftPose): number[] => {
	const composed = new Matrix4()
		.fromArray(matrixOf(parent))
		.multiply(new Matrix4().fromArray(matrixOf(child)))
	return [round(composed.elements[12]), round(composed.elements[13]), round(composed.elements[14])]
}

const ORIGIN: DraftPose = { x: 0, y: 0, z: 0 }

const UNIFORM_RGB = {
	r: round(UNIFORM_COLOR[0] / 255),
	g: round(UNIFORM_COLOR[1] / 255),
	b: round(UNIFORM_COLOR[2] / 255),
}

const VERTEX_RGB = [...VERTEX_COLORS]

/**
 * What one trait case must be observable as once it has crossed the wire.
 *
 * Each cell asserts only the traits its own case touches. Whether the rest of
 * the entity survived unchanged is the spawn/update parity spec's job, at unit
 * speed; what only the e2e can prove is that the field reached the browser at
 * all.
 */
export const expectationFor = (type: EntityTypeDescriptor, caseName: string): CellExpectation => {
	const hasObject3D = HAS_OBJECT3D.has(type.name)
	const needsCanvasProof = CANVAS_PROOF_TYPES.has(type.name)

	switch (caseName) {
		case 'pose': {
			return {
				state: {
					present: true,
					localMatrix: localMatrix(MOVED_POSE),
					worldPosition: composedTranslation(ORIGIN, MOVED_POSE),
				},
			}
		}

		case 'rotation': {
			return { state: { present: true, localMatrix: localMatrix(ROTATED_POSE) } }
		}

		// orphan must be undefined: the name alone reads back the same whether the
		// hierarchy resolved it or the entity is still waiting for a parent that
		// never arrived.
		case 'reparent': {
			return {
				state: {
					present: true,
					parent: PARENT_FRAME,
					orphan: undefined,
					worldPosition: composedTranslation(PARENT_POSE, ORIGIN),
				},
			}
		}

		case 'center': {
			return {
				state: {
					present: true,
					center: { x: OFFSET_CENTER.x, y: OFFSET_CENTER.y, z: OFFSET_CENTER.z },
				},
			}
		}

		case 'color-uniform': {
			return { state: { present: true, color: UNIFORM_RGB, colors: undefined } }
		}

		case 'colors-vertex':
		case 'color-swap': {
			// A point cloud keeps per-vertex colours in its geometry buffer and adds
			// no `Colors` trait, so the trait it must not have is the assertion.
			if (type.name === 'pcd') {
				return { state: { present: true, colors: undefined, color: undefined } }
			}
			return { state: { present: true, colors: VERTEX_RGB, color: undefined } }
		}

		case 'opacity': {
			return { state: { present: true, opacity: round(HALF_OPACITY[0] / 255) } }
		}

		case 'visibility': {
			return {
				state: {
					present: true,
					invisible: true,
					inheritedInvisible: true,
					...(hasObject3D && { object3d: { visible: false } }),
				},
				canvas: needsCanvasProof ? 'blank' : undefined,
			}
		}

		case 'visibility-unset': {
			return {
				state: {
					present: true,
					invisible: false,
					inheritedInvisible: false,
					...(hasObject3D && { object3d: { visible: true } }),
				},
				canvas: needsCanvasProof ? 'drawn' : undefined,
			}
		}

		case 'axes-helper': {
			return { state: { present: true, axesHelper: true } }
		}

		case 'axes-helper-unset': {
			return { state: { present: true, axesHelper: false } }
		}

		case 'point-size': {
			return { state: { present: true, pointSize: POINT_SIZE } }
		}

		case 'line-width': {
			return { state: { present: true, lineWidth: LINE_WIDTH } }
		}

		case 'dot-size': {
			return { state: { present: true, dotSize: DOT_SIZE } }
		}

		case 'dot-colors': {
			return { state: { present: true, dotColors: [...DOT_COLORS] } }
		}

		default: {
			throw new Error(`no expectation declared for trait case '${caseName}'`)
		}
	}
}

import type { Entity } from 'koota'

import { useThrelte } from '@threlte/core'
import { Matrix4, type Object3D, Quaternion, Raycaster, Vector2, Vector3 } from 'three'

import { useWorld } from '$lib/ecs'
import { useSettings } from '$lib/hooks/useSettings.svelte'

import { dragConstraintFor } from './dragConstraint'
import { resolveSnap } from './resolveSnap'
import { type SnapIndicator } from './snapQuery'
import { posedTargets, type SnapScene, snapSceneFor } from './snapScene'

const UNIT_SCALE = new Vector3(1, 1, 1)

/** Object snapping for one translate gizmo, from pointer down to pointer up. */
export interface ObjectSnapDrag {
	/** Whether Ctrl or ⌘ is held mid-drag, flipping the snapping master switch. */
	readonly isInverted: boolean
	/** Where the current snap landed, for the scene to mark. */
	readonly indicator: SnapIndicator | undefined
	/** Whether a translate drag may also turn the object, so staging has to write orientation. */
	readonly alignsRotation: boolean
	/** Gathers what the drag of `entity` snaps with and against. Call on pointer down. */
	begin: (entity: Entity, anchor: Object3D) => void
	/**
	 * Moves `anchor`, already placed by the gizmo, onto the snap under the cursor. Leaves it where
	 * it is when nothing is in reach.
	 *
	 * @param axis The gizmo handle being dragged, `TransformControls.axis`.
	 */
	apply: (anchor: Object3D, axis: string) => void
	end: () => void
}

/**
 * Object snapping for a translate gizmo: the key points and surfaces of other geometries, per the
 * snap settings. Tracks the cursor itself, since `TransformControls` keeps its pointer private.
 */
export const useObjectSnapDrag = (): ObjectSnapDrag => {
	const { camera, renderer } = useThrelte()
	const world = useWorld()
	const settings = useSettings()

	let isInverted = $state(false)
	let indicator = $state.raw<SnapIndicator>()
	let scene: SnapScene | undefined

	const startOrientation = new Quaternion()
	const cursorPixels = new Vector2()
	const cursorNdc = new Vector2()
	const raycaster = new Raycaster()
	const projected = new Vector3()
	const anchorMatrix = new Matrix4()

	const isSnappingObjects = () =>
		settings.current.snapping !== isInverted && settings.current.snapObjects

	const trackPointer = (event: PointerEvent) => {
		const rect = renderer.domElement.getBoundingClientRect()
		cursorPixels.set(event.clientX - rect.left, event.clientY - rect.top)
		cursorNdc.set((cursorPixels.x / rect.width) * 2 - 1, 1 - (cursorPixels.y / rect.height) * 2)
		if (scene) isInverted = event.ctrlKey || event.metaKey
	}

	// Capture phase, so the cursor is current before `TransformControls` handles the same move
	// and fires the change that reads it.
	$effect(() => {
		window.addEventListener('pointermove', trackPointer, { capture: true })
		return () => window.removeEventListener('pointermove', trackPointer, { capture: true })
	})

	const toScreen = (point: Vector3, out: Vector2): boolean => {
		projected.copy(point).project(camera.current)
		// Past the far plane, which is also where a perspective camera sends points behind it.
		if (projected.z > 1) return false

		const { clientWidth, clientHeight } = renderer.domElement
		out.set(((projected.x + 1) / 2) * clientWidth, ((1 - projected.y) / 2) * clientHeight)
		return true
	}

	return {
		get isInverted() {
			return isInverted
		},
		get indicator() {
			return indicator
		},
		get alignsRotation() {
			return settings.current.snapObjects && settings.current.snapAlignRotation
		},
		begin: (entity, anchor) => {
			startOrientation.copy(anchor.quaternion)
			anchorMatrix.compose(anchor.position, anchor.quaternion, UNIT_SCALE)
			scene = snapSceneFor(world, entity, anchorMatrix)
		},
		apply: (anchor, axis) => {
			indicator = undefined
			if (!scene) return

			// A translate gizmo never turns the anchor, so only an earlier alignment can have.
			anchor.quaternion.copy(startOrientation)

			if (isSnappingObjects()) {
				raycaster.setFromCamera(cursorNdc, camera.current)
				const result = resolveSnap({
					position: anchor.position.clone(),
					orientation: startOrientation,
					dragged: scene.dragged,
					targets: posedTargets(scene.targets),
					constraint: dragConstraintFor(axis, settings.current.transformSpace, startOrientation),
					ray: raycaster.ray,
					cursor: cursorPixels,
					toScreen,
					groundPlane: settings.current.snapGroundPlane,
					alignRotation: settings.current.snapAlignRotation,
				})

				if (result) {
					anchor.position.copy(result.position)
					anchor.quaternion.copy(result.orientation)
					indicator = result.indicator
				}
			}

			anchor.updateMatrixWorld()
		},
		end: () => {
			scene = undefined
			indicator = undefined
			isInverted = false
		},
	}
}

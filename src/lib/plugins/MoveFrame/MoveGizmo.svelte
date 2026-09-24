<script lang="ts">
	import type { TransformControls as ThreeTransformControls } from 'three/addons/controls/TransformControls.js'

	import { T, useThrelte } from '@threlte/core'
	import { TransformControls } from '@threlte/extras'
	import { onDestroy } from 'svelte'
	import { Group, MathUtils, Matrix4, Vector3 } from 'three'

	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { isolateTransformControls } from '$lib/three/renderLayers'

	interface Props {
		/** Where the frame is right now — world space, metres. */
		currentWorldMatrix: Matrix4
		/** The staged target, or `undefined` while the handle still tracks the frame. */
		targetWorldMatrix?: Matrix4
		mode: 'translate' | 'rotate'
		space: 'local' | 'world'
		/** Reports the dragged transform, world space, on every pointer move. */
		onDrag: (targetWorldMatrix: Matrix4) => void
	}

	const { currentWorldMatrix, targetWorldMatrix, mode, space, onDrag }: Props = $props()

	const { invalidate } = useThrelte()
	const settings = useSettings()
	const transformControls = useTransformControls()

	const UNIT_SCALE = new Vector3(1, 1, 1)

	/**
	 * The handle `TransformControls` drags. It reads and writes
	 * `position`/`quaternion`, so `matrixAutoUpdate` stays on and three recomposes
	 * the matrix from the drag. It mounts at the scene root — where the entity
	 * renderers mount — so its local transform is already world space.
	 */
	const anchor = new Group()

	let dragging = false
	let controls = $state.raw<ThreeTransformControls>()

	$effect(() => {
		if (controls) isolateTransformControls(controls)
	})

	/**
	 * Seed the handle from the staged target, falling back to the frame's live
	 * transform while nothing is staged. Skipped mid-drag: the frame keeps
	 * streaming poses and re-seeding would yank the handle out from under the
	 * pointer.
	 */
	$effect.pre(() => {
		const source = targetWorldMatrix ?? currentWorldMatrix
		if (dragging) return

		source.decompose(anchor.position, anchor.quaternion, anchor.scale)
		// Frames carry no scale. A non-unit one would only distort the gizmo.
		anchor.scale.copy(UNIT_SCALE)
		anchor.updateMatrixWorld()
		invalidate()
	})

	const onMouseDown = () => {
		dragging = true
		// Park the camera controls so an orbit drag can't ride along with the gizmo.
		transformControls.setActive(true)
	}

	const onObjectChange = () => {
		onDrag(new Matrix4().compose(anchor.position, anchor.quaternion, UNIT_SCALE))
	}

	const onMouseUp = () => {
		dragging = false
		transformControls.setActive(false)
	}

	// Unmounting mid-drag (panel closed, tab switched, gizmo handed off) never
	// fires `mouseUp`, which would leave the camera controls parked for good.
	onDestroy(() => {
		if (dragging) transformControls.setActive(false)
	})

	const snapping = $derived(settings.current.snapping)
</script>

<T
	is={anchor}
	dispose={false}
/>

<TransformControls
	bind:controls
	object={anchor}
	{mode}
	{space}
	translationSnap={snapping && settings.current.snapTranslate > 0
		? settings.current.snapTranslate
		: null}
	rotationSnap={snapping && settings.current.snapRotate > 0
		? MathUtils.degToRad(settings.current.snapRotate)
		: null}
	onmouseDown={onMouseDown}
	onobjectChange={onObjectChange}
	onmouseUp={onMouseUp}
/>

<script lang="ts">
	import type { Snippet } from 'svelte'

	import { T, useTask, useThrelte } from '@threlte/core'
	import { useHeadset } from '@threlte/xr'
	import { Group, Vector3 } from 'three'
	import { provideDefaultProperties } from 'threlte-uikit'

	interface Props {
		/** Lerp factor per frame toward the headset position. Higher = snappier. */
		smoothing?: number
		children?: Snippet
	}

	const { smoothing = 0.1, children }: Props = $props()

	// Ensure every uikit component rendered inside the HUD draws on top of the
	// rest of the scene (real-world depth, selected-frame OBB, etc.).
	provideDefaultProperties(() => ({
		depthTest: false,
		renderOrder: 999,
	}))

	const { scene } = useThrelte()
	const group = new Group()
	// World up is Z in Viam's coordinate system (XR.svelte rotates the reference
	// space by -π/2 around X). Required so lookAt snaps the HUD to head yaw
	// without inheriting head pitch or roll.
	group.up.set(0, 0, 1)
	const headset = useHeadset()

	const forward = new Vector3()
	const lookTarget = new Vector3()
	let snapped = false

	useTask(() => {
		// First tick: snap to the headset pose so panels don't animate in from
		// the scene origin. After that, lerp so they follow head motion smoothly.
		if (snapped) {
			group.position.lerp(headset.position, smoothing)
		} else {
			group.position.copy(headset.position)
			snapped = true
		}

		// Snap (don't lerp) rotation to the head's yaw-only direction: project the
		// head's forward vector onto the horizontal plane and lookAt along it. If
		// the user looks straight up/down, the projection is degenerate — hold the
		// previous rotation.
		//
		// `Object3D.lookAt` for non-cameras orients the target so its local +Z
		// points AT the target. To match the convention child offsets are written
		// for (local −Z = forward, like a camera), aim lookAt at `position - forward`
		// so that local −Z ends up pointing along the user's forward direction.
		forward.set(0, 0, -1).applyQuaternion(headset.quaternion)
		forward.z = 0
		if (forward.lengthSq() < 1e-6) return
		forward.normalize()
		lookTarget.copy(group.position).sub(forward)
		group.lookAt(lookTarget)
	})
</script>

<T
	is={group}
	attach={scene}
>
	{@render children?.()}
</T>

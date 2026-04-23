<script lang="ts">
	import type { Snippet } from 'svelte'

	import { T, useTask } from '@threlte/core'
	import { useHeadset } from '@threlte/xr'
	import { Group, type Vector3Tuple } from 'three'

	// Faces the user by calling `group.lookAt(headset.position)` each frame.
	// Unlike `@threlte/extras` Billboard, this pulls no rotation from the
	// follow target — pitch and roll of the head do not tilt the panel. Only
	// the point-at geometry matters, so panels always stay upright (up = world
	// +Z in Viam's Z-up frame).
	interface Props {
		position?: Vector3Tuple
		children?: Snippet
	}

	const { position, children }: Props = $props()

	const group = new Group()
	group.up.set(0, 0, 1)
	const headset = useHeadset()

	useTask(() => {
		group.lookAt(headset.position)
	})
</script>

<T
	is={group}
	{position}
>
	{@render children?.()}
</T>

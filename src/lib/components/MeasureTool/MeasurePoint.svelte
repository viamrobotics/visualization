<script lang="ts">
	import type { Group, Vector3Tuple } from 'three'

	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { HTML } from '@threlte/extras'

	interface Props extends ThrelteProps<typeof Group> {
		position: Vector3Tuple
	}

	let { position, ref = $bindable(), ...rest }: Props = $props()
</script>

<T.Group
	bind:ref
	{...rest}
	{position}
>
	<HTML
		center
		zIndexRange={[3, 0]}
		class="h-2.5 w-2.5 rounded-full bg-black/70"
	/>

	<HTML
		class="pointer-events-none mb-2 w-16 -translate-x-1/2 -translate-y-[calc(100%+10px)] border border-black bg-white px-1 py-0.5 text-xs text-wrap"
		zIndexRange={[3, 0]}
	>
		<div class="flex justify-between">
			<span class="text-subtle-2">x</span>
			<div>
				{position[0].toFixed(3)}<span class="text-subtle-2">m</span>
			</div>
		</div>

		<div class="flex justify-between">
			<span class="text-subtle-2">y</span>
			<div>
				{position[1].toFixed(3)}<span class="text-subtle-2">m</span>
			</div>
		</div>

		<div class="flex justify-between">
			<span class="text-subtle-2">z</span>
			<div>
				{position[2].toFixed(3)}<span class="text-subtle-2">m</span>
			</div>
		</div>
	</HTML>
</T.Group>

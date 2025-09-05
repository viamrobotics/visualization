<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import type { ColorRepresentation, Vector3Tuple, Group } from 'three'
	import { HTML } from '@threlte/extras'

	interface Props extends ThrelteProps<typeof Group> {
		position: Vector3Tuple
		color?: ColorRepresentation
		opacity?: number
	}

	let { position, color, opacity = 1, ref = $bindable(), ...rest }: Props = $props()
</script>

<T.Group
	bind:ref
	{...rest}
	{position}
>
	<T.Mesh
		bvh={{ enabled: false }}
		raycast={() => null}
		scale={0.01}
		renderOrder={1}
	>
		<T.SphereGeometry />
		<T.MeshBasicMaterial
			color={color ?? 'black'}
			transparent
			depthTest={false}
			{opacity}
		/>
	</T.Mesh>

	<HTML
		class="pointer-events-none mb-2 w-16 -translate-x-1/2 -translate-y-[calc(100%+10px)] border border-black bg-white px-1 py-0.5 text-xs text-wrap"
	>
		<div class="flex justify-between">
			<span class="text-subtle-2">x</span>
			<div>
				{position[0].toFixed(2)}<span class="text-subtle-2">m</span>
			</div>
		</div>

		<div class="flex justify-between">
			<span class="text-subtle-2">y</span>
			<div>
				{position[1].toFixed(2)}<span class="text-subtle-2">m</span>
			</div>
		</div>

		<div class="flex justify-between">
			<span class="text-subtle-2">z</span>
			<div>
				{position[2].toFixed(2)}<span class="text-subtle-2">m</span>
			</div>
		</div>
	</HTML>
</T.Group>

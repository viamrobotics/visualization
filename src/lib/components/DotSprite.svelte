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
		center
		position.z={0.1}
	>
		<div
			class="pointer-events-none w-14 border border-black bg-white px-1 py-0.5 text-xs text-wrap"
		>
			<div class="flex justify-between">
				<span class="text-subtle-2">x</span>
				{position[0].toFixed(2)}
			</div>

			<div class="flex justify-between">
				<span class="text-subtle-2">y</span>
				{position[1].toFixed(2)}
			</div>

			<div class="flex justify-between">
				<span class="text-subtle-2">z</span>
				{position[2].toFixed(2)}
			</div>
		</div>
	</HTML>
</T.Group>

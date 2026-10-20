<script lang="ts">
	import { T } from '@threlte/core'
	import { HTML, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { Vector3 } from 'three'

	import type { SnapIndicator } from '$lib/snapping/snapQuery'

	interface Props {
		indicator: SnapIndicator
	}

	const { indicator }: Props = $props()

	// Long enough to read the surface's tilt at a glance, short enough to stay out of the way.
	const NORMAL_LENGTH_M = 0.1

	const normalLine = $derived(
		indicator.kind === 'surface'
			? [
					indicator.point,
					new Vector3().copy(indicator.point).addScaledVector(indicator.normal, NORMAL_LENGTH_M),
				]
			: undefined
	)
</script>

<T.Group position={indicator.point.toArray()}>
	<!-- `HTML` hands its own wrapper only `class` and `style`, so the decorative dot is a child that can carry `aria-hidden`. -->
	<HTML
		center
		zIndexRange={[3, 0]}
		class="pointer-events-none"
	>
		<span
			aria-hidden="true"
			class={[
				'block h-3 w-3 rounded-full border-2 border-black/70',
				indicator.kind === 'surface' && 'bg-black/70',
			]}
		></span>
	</HTML>
</T.Group>

{#if normalLine}
	<T.Mesh
		raycast={() => null}
		bvh={{ enabled: false }}
		renderOrder={1}
	>
		<MeshLineGeometry points={normalLine} />
		<MeshLineMaterial
			width={2.5}
			depthTest={false}
			color="black"
			opacity={0.7}
			attenuate={false}
			transparent
		/>
	</T.Mesh>
{/if}

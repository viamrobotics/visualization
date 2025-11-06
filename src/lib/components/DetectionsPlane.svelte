<script lang="ts">
	import { T } from '@threlte/core'
	import { Detection } from '@viamrobotics/sdk'

	export let detections: Detection[]
</script>

<T.Group scale={0.001}>
	{#each detections as { xMin, xMax, yMin, yMax }, index (index)}
		{#if xMin !== undefined && xMax !== undefined && yMin !== undefined && yMax !== undefined}
			<T.Mesh
				scale={[Number(xMax - xMin), Number(yMax - yMin), 1]}
				position={[Number(xMin), Number(yMin), 0]}
			>
				<T.PlaneGeometry />
				<T.MeshStandardMaterial
					transparent
					opacity={0.5}
				/>
			</T.Mesh>
		{/if}
	{/each}
</T.Group>

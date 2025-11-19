<script lang="ts">
	import { T } from '@threlte/core'
	import { Instance, InstancedMesh } from '@threlte/extras'
	import Frame from './Frame.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import type { Snippet } from 'svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const settings = useSettings()
	const points = useTrait(() => entity, traits.LineGeometry)
</script>

<Frame {entity} />

{#if entity.metadata.lineDotColor && points.current}
	<InstancedMesh frustumCulled={false}>
		<T.SphereGeometry />
		<T.MeshBasicMaterial color={object.metadata.lineDotColor} />

		{#each points.current as { x, y, z }, i (i)}
			<Instance
				position.x={x}
				position.y={y}
				position.z={z}
				scale={Number(settings.current.lineDotSize)}
			/>
		{/each}

		{@render children?.()}
	</InstancedMesh>
{/if}

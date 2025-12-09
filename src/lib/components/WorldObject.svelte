<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import type { Snippet } from 'svelte'
	import type { Object3D } from 'three'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'

	interface Props extends ThrelteProps<Object3D> {
		object: WorldObject
		children?: Snippet
	}

	let { object, children, ...rest }: Props = $props()

	const objectProps = useObjectEvents(() => object.uuid)
</script>

{#if object.metadata.gltf?.scene}
	<T
		is={object.metadata.gltf.scene as Object3D}
		uuid={object.uuid}
		name={object.name}
		{...objectProps}
		{...rest}
	>
		{@render children?.()}
	</T>
{/if}

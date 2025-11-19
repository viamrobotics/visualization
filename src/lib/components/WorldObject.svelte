<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import type { Snippet } from 'svelte'
	import type { Object3D } from 'three'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'

	interface Props extends ThrelteProps<Object3D> {
		entity: Entity
		children?: Snippet
	}

	let { entity, children, ...rest }: Props = $props()

	const uuid = useTrait(() => entity, traits.UUID)
	const name = useTrait(() => entity, traits.Name)
	const gltf = useTrait(() => entity, traits.GLTF)
	const objectProps = useObjectEvents(() => uuid.current)
</script>

{#if gltf.current?.scene}
	<T
		is={gltf.current.scene}
		{uuid}
		{name}
		{...objectProps}
		{...rest}
	>
		{@render children?.()}
	</T>
{/if}

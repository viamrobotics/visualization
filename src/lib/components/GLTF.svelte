<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { Portal, PortalTarget } from '@threlte/extras'
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

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const gltf = useTrait(() => entity, traits.GLTF)
	const objectProps = useObjectEvents(() => entity)
</script>

<Portal id={parent.current}>
	{#if gltf.current?.scene}
		<T
			is={gltf.current.scene as Object3D}
			name={name.current}
			{...objectProps}
			{...rest}
		>
			{@render children?.()}

			<PortalTarget id={name.current} />
		</T>
	{/if}
</Portal>

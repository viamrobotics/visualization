<!--
@component

The cursor shown while hovering a surface: a dot at the hit point, labeled with the
entity's name so the user knows which surface a placement will land on.
-->
<script lang="ts">
	import type { Entity } from 'koota'
	import type { Group, Vector3Tuple } from 'three'

	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { HTML } from '@threlte/extras'

	import { traits, useTrait } from '$lib/ecs'

	interface Props extends ThrelteProps<typeof Group> {
		entity: Entity
		position: Vector3Tuple
	}

	let { entity, position, ref = $bindable(), ...rest }: Props = $props()

	const name = useTrait(() => entity, traits.Name)
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
		class="pointer-events-none mb-2 -translate-x-1/2 -translate-y-[calc(100%+10px)] border border-black bg-white px-1 py-0.5 text-xs whitespace-nowrap"
		zIndexRange={[3, 0]}
	>
		{name.current || 'surface'}
	</HTML>
</T.Group>

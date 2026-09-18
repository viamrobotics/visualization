<!--
@component

The cursor shown while hovering a surface: a dot at the hit point, labeled with the
entity's name so the user knows which surface a placement will land on.
-->
<script lang="ts">
	import type { Entity } from 'koota'
	import type { Group, Vector3Tuple } from 'three'

	import { type Props as ThrelteProps } from '@threlte/core'

	import MeasurePoint from '$lib/components/MeasurePoint.svelte'
	import { traits, useTrait } from '$lib/ecs'

	interface Props extends ThrelteProps<typeof Group> {
		entity: Entity
		position: Vector3Tuple
	}

	let { entity, position, ref = $bindable(), ...rest }: Props = $props()

	const name = useTrait(() => entity, traits.Name)
</script>

<MeasurePoint
	bind:ref
	{...rest}
	{position}
>
	{#snippet label()}
		{name.current || 'surface'}
	{/snippet}
</MeasurePoint>

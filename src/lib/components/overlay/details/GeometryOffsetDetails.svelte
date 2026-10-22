<script
	module
	lang="ts"
>
	import { Pose } from '$lib/math'

	const IDENTITY_POSE = new Pose()
</script>

<script lang="ts">
	import { type Entity } from 'koota'

	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const framesAPI = useTrait(() => entity, traits.FramesAPI)
	const center = useTrait(() => entity, traits.Center)

	// A frame's displayed pose is its origin, so an offset geometry would sit away from it with
	// no explanation. Other entities already fold their center into the displayed pose.
	const offset = $derived(
		framesAPI.current && center.current && !IDENTITY_POSE.equals(center.current)
			? center.current
			: undefined
	)
</script>

{#snippet ImmutableField({ label, value }: { label: string; value: number })}
	<div>
		<span
			class="text-subtle-2"
			aria-label={`immutable geometry offset ${label}`}
		>
			{label}
		</span>

		{value.toFixed(2)}
	</div>
{/snippet}

{#if offset}
	<div>
		<strong class="font-semibold">geometry offset</strong>
		<span class="text-subtle-2">(mm)</span>
		<div class="mt-0.5 flex items-center gap-2">
			{@render ImmutableField({ label: 'x', value: offset.x })}
			{@render ImmutableField({ label: 'y', value: offset.y })}
			{@render ImmutableField({ label: 'z', value: offset.z })}
		</div>
	</div>

	<div>
		<strong class="font-semibold">geometry orientation</strong>
		<span class="text-subtle-2">(deg)</span>
		<div class="mt-0.5 flex items-center gap-2">
			{@render ImmutableField({ label: 'ox', value: offset.oX })}
			{@render ImmutableField({ label: 'oy', value: offset.oY })}
			{@render ImmutableField({ label: 'oz', value: offset.oZ })}
			{@render ImmutableField({ label: 'th', value: offset.theta })}
		</div>
	</div>
{/if}

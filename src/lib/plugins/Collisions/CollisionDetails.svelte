<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { Icon } from '@viamrobotics/prime-core'
	import { type Entity } from 'koota'

	import DetailsPanel from '$lib/components/overlay/details/DetailsPanel.svelte'
	import EntityLink from '$lib/components/overlay/EntityLink.svelte'
	import { traits, useTrait } from '$lib/ecs'
	import { liveFrameName } from '$lib/plugins/MoveFrame/previewNames'

	import { CollidesWith } from './relations'
	import { Collision } from './traits'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		entity: Entity
	}

	const { entity, ...rest }: Props = $props()

	const MM_PER_M = 1000

	const collision = useTrait(() => entity, Collision)

	/**
	 * Read off the relation each time a pass rewrites `Collision`, which is also when the sides can
	 * change. A preview twin is listed by the live frame it mirrors, as the tree row names it.
	 */
	const sides = $derived.by(() => {
		if (!collision.current) return []

		return entity
			.targetsFor(CollidesWith)
			.map((target) => ({ target, label: liveFrameName(target.get(traits.Name) ?? 'unnamed') }))
			.toSorted((x, y) => (x.label < y.label ? -1 : x.label > y.label ? 1 : 0))
	})

	const toMillimetres = (metres: number) => (metres * MM_PER_M).toFixed(2)
</script>

<DetailsPanel
	{entity}
	sceneActions={false}
	{...rest}
>
	{#if collision.current}
		{@const { staged, depth, x, y, z } = collision.current}
		<div class="flex flex-col gap-2.5 pt-3">
			{#if staged}
				<div
					class="border-danger-medium bg-danger-light text-danger-dark flex items-center gap-1.5 border px-2 py-1.5"
				>
					<Icon
						name="alert-circle"
						aria-hidden="true"
					/>
					<span class="font-semibold">Move would collide</span>
				</div>
			{:else}
				<p class="text-subtle-1">Intersecting now.</p>
			{/if}

			<div>
				<strong class="font-semibold">between</strong>
				<ul class="mt-0.5 flex flex-col gap-0.5">
					{#each sides as { target, label } (target)}
						<li>
							<EntityLink
								entity={target}
								{label}
							/>
						</li>
					{/each}
				</ul>
			</div>

			<div>
				<strong class="font-semibold">penetration depth</strong>
				<span class="text-subtle-2">(mm)</span>
				<div class="font-roboto-mono mt-0.5">{toMillimetres(depth)}</div>
			</div>

			<div>
				<strong class="font-semibold">contact point</strong>
				<span class="text-subtle-2">(world) (mm)</span>
				<div class="font-roboto-mono mt-0.5 flex items-center gap-2">
					<div><span class="text-subtle-2">x</span> {toMillimetres(x)}</div>
					<div><span class="text-subtle-2">y</span> {toMillimetres(y)}</div>
					<div><span class="text-subtle-2">z</span> {toMillimetres(z)}</div>
				</div>
			</div>
		</div>
	{/if}
</DetailsPanel>

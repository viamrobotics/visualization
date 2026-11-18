<script lang="ts">
	import type { Entity } from 'koota'

	import { Button } from '@viamrobotics/prime-core'

	import AppearanceFields from '$lib/components/overlay/details/AppearanceFields.svelte'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import {
		frameAppearanceOf,
		hasFrameAppearances,
		inheritedAppearance,
		resourceAppearanceOf,
		type ResourceAppearancePatch,
		withFrameAppearance,
		withoutFrameAppearance,
		withoutFrameAppearances,
		withoutResourceAppearance,
		withResourceAppearance,
	} from '$lib/resourceAppearance'

	interface Props {
		/** The frame being styled, whose current look fills in what the config leaves unset. */
		entity: Entity
		/** The part-owned component the appearance is saved on. */
		component: PartComponent
		/**
		 * The id after `<name>:` of the frame inside the component being styled, or undefined when it
		 * is the component's own frame.
		 */
		frameId: string | undefined
	}

	const { entity, component, frameId }: Props = $props()

	const partConfig = usePartConfig()

	const values = $derived(
		frameId === undefined ? resourceAppearanceOf(component) : frameAppearanceOf(component, frameId)
	)
	const fallback = $derived(
		frameId === undefined ? {} : inheritedAppearance(resourceAppearanceOf(component))
	)
	const isOwnSaved = $derived(Object.keys(values).length > 0)
	const hasSavedChildren = $derived(frameId === undefined && hasFrameAppearances(component))

	const write = (visualizer: Record<string, unknown>) => {
		partConfig.updateComponent(component.name, { visualizer })
	}

	const update = (patch: ResourceAppearancePatch) => {
		write(
			frameId === undefined
				? withResourceAppearance(component, patch)
				: withFrameAppearance(component, frameId, patch)
		)
	}

	const handleReset = () => {
		write(
			frameId === undefined
				? withoutResourceAppearance(component)
				: withoutFrameAppearance(component, frameId)
		)
	}
</script>

<div class="flex flex-col gap-2.5 pt-3">
	<p class="text-subtle-2">
		{#if frameId === undefined}
			Saved to this resource's config.
		{:else}
			Saved to {component.name}'s config. Values not changed here follow {component.name}.
		{/if}
	</p>

	<AppearanceFields
		{entity}
		{values}
		{fallback}
		showsVisibility
		onchange={update}
	/>

	{#if isOwnSaved}
		<Button
			variant="ghost-outline"
			class="w-full"
			onclick={handleReset}
		>
			{frameId === undefined ? 'Reset appearance' : `Reset to ${component.name}`}
		</Button>
	{/if}

	{#if hasSavedChildren}
		<Button
			variant="ghost-outline"
			class="w-full"
			onclick={() => write(withoutFrameAppearances(component))}
		>
			Reset children
		</Button>
	{/if}
</div>

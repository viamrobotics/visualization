<!--
@component

A frame's appearance outside build mode, held for the session and never written to the config. It
follows the same rules as the saved appearance: an edit lays over what the config saves, and a
frame inside a resource, such as an obstacle's shape, follows the resource unless it sets its own.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { Button } from '@viamrobotics/prime-core'

	import AppearanceFields from '$lib/components/overlay/details/AppearanceFields.svelte'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { useResourceAppearance } from '$lib/hooks/useResourceAppearance.svelte'
	import {
		frameAppearanceOf,
		hasFrameAppearances,
		inheritedAppearance,
		type ResourceAppearance,
		resourceAppearanceOf,
		type ResourceAppearancePatch,
		withFrameAppearance,
		withoutFrameAppearance,
		withoutFrameAppearances,
		withoutResourceAppearance,
		withResourceAppearance,
	} from '$lib/resourceAppearance'

	interface Props {
		/** The frame being styled, whose current look fills in what nothing sets. */
		entity: Entity
		/** The component the edits are kept under. It need not be in the part config. */
		componentName: string
		/**
		 * The id after `<name>:` of the frame inside the component being styled, or undefined when it
		 * is the component's own frame.
		 */
		frameId: string | undefined
	}

	const { entity, componentName, frameId }: Props = $props()

	const partConfig = usePartConfig()
	const resourceAppearance = useResourceAppearance()

	// The session's edits are kept in the shape of a `visualizer` config, so they read and write
	// through the same helpers as a saved one.
	const edited = $derived<PartComponent>({
		name: componentName,
		visualizer: resourceAppearance.session.get(componentName),
	})
	const saved = $derived<PartComponent>(
		partConfig.current.components?.find((component) => component.name === componentName) ?? {
			name: componentName,
		}
	)

	const levelOf = (component: PartComponent): ResourceAppearance =>
		frameId === undefined ? resourceAppearanceOf(component) : frameAppearanceOf(component, frameId)

	const values = $derived(levelOf(edited))
	// A key left unset shows what the config saves at this level, then what a frame inside follows.
	const fallback = $derived<ResourceAppearance>({
		...(frameId === undefined
			? {}
			: inheritedAppearance(resourceAppearance.current.get(componentName)?.own ?? {})),
		...levelOf(saved),
	})
	const isOwnEdited = $derived(Object.keys(values).length > 0)
	const hasEditedChildren = $derived(frameId === undefined && hasFrameAppearances(edited))

	const write = (visualizer: Record<string, unknown>) => {
		resourceAppearance.setSession(componentName, visualizer)
	}

	const update = (patch: ResourceAppearancePatch) => {
		write(
			frameId === undefined
				? withResourceAppearance(edited, patch)
				: withFrameAppearance(edited, frameId, patch)
		)
	}

	const handleReset = () => {
		write(
			frameId === undefined
				? withoutResourceAppearance(edited)
				: withoutFrameAppearance(edited, frameId)
		)
	}
</script>

<div class="flex flex-col gap-2.5 pt-3">
	<p class="text-subtle-2">
		Not saved, and a reload drops these changes. Build mode saves an appearance to the config.
		{#if frameId !== undefined}
			Values not changed here follow {componentName}.
		{/if}
	</p>

	<AppearanceFields
		{entity}
		{values}
		{fallback}
		showsVisibility={false}
		onchange={update}
	/>

	{#if isOwnEdited}
		<Button
			variant="ghost-outline"
			class="w-full"
			onclick={handleReset}
		>
			Reset appearance
		</Button>
	{/if}

	{#if hasEditedChildren}
		<Button
			variant="ghost-outline"
			class="w-full"
			onclick={() => write(withoutFrameAppearances(edited))}
		>
			Reset children
		</Button>
	{/if}
</div>

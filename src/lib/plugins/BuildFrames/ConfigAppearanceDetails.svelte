<script
	module
	lang="ts"
>
	import type { Entity } from 'koota'

	import type { PartComponent } from '#lib/hooks/usePartConfig.svelte.js'

	/** One selected frame whose appearance is saved to the config. */
	export interface ConfigAppearanceTarget {
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
</script>

<script lang="ts">
	import { Button } from '@viamrobotics/prime-core'

	import { type AppearanceEdit, foldAppearanceEdits } from '#lib/appearanceEdits.js'
	import AppearanceFields from '#lib/components/overlay/details/AppearanceFields.svelte'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
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
	} from '#lib/resourceAppearance.js'

	interface Props {
		/** One per selected frame. Never empty. */
		targets: ConfigAppearanceTarget[]
	}

	const { targets }: Props = $props()

	const partConfig = usePartConfig()

	const fieldTargets = $derived(
		targets.map(({ entity, component, frameId }) => ({
			entity,
			values:
				frameId === undefined
					? resourceAppearanceOf(component)
					: frameAppearanceOf(component, frameId),
			fallback: frameId === undefined ? {} : inheritedAppearance(resourceAppearanceOf(component)),
		}))
	)

	const savedTargets = $derived(
		targets.filter((_, index) => Object.keys(fieldTargets[index]?.values ?? {}).length > 0)
	)
	const targetsWithSavedChildren = $derived(
		targets.filter(
			({ component, frameId }) => frameId === undefined && hasFrameAppearances(component)
		)
	)

	const isSingle = $derived(targets.length === 1)
	const only = $derived(isSingle ? targets[0] : undefined)
	const hasInnerFrame = $derived(targets.some(({ frameId }) => frameId !== undefined))

	const write = (edits: AppearanceEdit[]) => {
		for (const [name, visualizer] of foldAppearanceEdits(edits)) {
			partConfig.updateComponent(name, { visualizer })
		}
	}

	const update = (patches: ResourceAppearancePatch[]) => {
		write(
			targets.map(({ component, frameId }, index) => ({
				component,
				edit: (current) => {
					const patch = patches[index] ?? {}
					return frameId === undefined
						? withResourceAppearance(current, patch)
						: withFrameAppearance(current, frameId, patch)
				},
			}))
		)
	}

	const handleReset = () => {
		write(
			savedTargets.map(({ component, frameId }) => ({
				component,
				edit: (current) =>
					frameId === undefined
						? withoutResourceAppearance(current)
						: withoutFrameAppearance(current, frameId),
			}))
		)
	}

	const handleResetChildren = () => {
		write(
			targetsWithSavedChildren.map(({ component }) => ({
				component,
				edit: withoutFrameAppearances,
			}))
		)
	}
</script>

<div class="flex flex-col gap-2.5 pt-3">
	<p class="text-subtle-2">
		{#if only?.frameId !== undefined && only}
			Saved to {only.component.name}'s config. Values not changed here follow {only.component.name}.
		{:else if only}
			Saved to this resource's config.
		{:else}
			Saved to each resource's config.
			{#if hasInnerFrame}
				Values not changed here follow each frame's resource.
			{/if}
		{/if}
	</p>

	<AppearanceFields
		targets={fieldTargets}
		showsVisibility
		onchange={update}
	/>

	{#if savedTargets.length > 0}
		<Button
			variant="ghost-outline"
			class="w-full"
			onclick={handleReset}
		>
			{only?.frameId !== undefined && only ? `Reset to ${only.component.name}` : 'Reset appearance'}
		</Button>
	{/if}

	{#if targetsWithSavedChildren.length > 0}
		<Button
			variant="ghost-outline"
			class="w-full"
			onclick={handleResetChildren}
		>
			Reset children
		</Button>
	{/if}
</div>

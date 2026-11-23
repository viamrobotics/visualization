<script
	module
	lang="ts"
>
	import type { Entity } from 'koota'

	/** One selected frame whose appearance edits last for the session. */
	export interface SessionAppearanceTarget {
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
</script>

<script lang="ts">
	import { Button } from '@viamrobotics/prime-core'

	import { type AppearanceEdit, foldAppearanceEdits } from '#lib/appearanceEdits.js'
	import AppearanceFields from '#lib/components/overlay/details/AppearanceFields.svelte'
	import { type PartComponent, usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { useResourceAppearance } from '#lib/hooks/useResourceAppearance.svelte.js'
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
	} from '#lib/resourceAppearance.js'

	interface Props {
		/** One per selected frame. Never empty. */
		targets: SessionAppearanceTarget[]
	}

	const { targets }: Props = $props()

	const partConfig = usePartConfig()
	const resourceAppearance = useResourceAppearance()

	// The session's edits are kept in the shape of a `visualizer` config, so they read and write
	// through the same helpers as a saved one.
	const editedOf = (componentName: string): PartComponent => ({
		name: componentName,
		visualizer: resourceAppearance.session.get(componentName),
	})
	const savedOf = (componentName: string): PartComponent =>
		partConfig.current.components?.find((component) => component.name === componentName) ?? {
			name: componentName,
		}

	const levelOf = (component: PartComponent, frameId: string | undefined): ResourceAppearance =>
		frameId === undefined ? resourceAppearanceOf(component) : frameAppearanceOf(component, frameId)

	const fieldTargets = $derived(
		targets.map(({ entity, componentName, frameId }) => ({
			entity,
			values: levelOf(editedOf(componentName), frameId),
			// A key left unset shows what the config saves at this level, then what a frame inside follows.
			fallback: {
				...(frameId === undefined
					? {}
					: inheritedAppearance(resourceAppearance.current.get(componentName)?.own ?? {})),
				...levelOf(savedOf(componentName), frameId),
			},
		}))
	)

	const editedTargets = $derived(
		targets.filter((_, index) => Object.keys(fieldTargets[index]?.values ?? {}).length > 0)
	)
	const targetsWithEditedChildren = $derived(
		targets.filter(
			({ componentName, frameId }) =>
				frameId === undefined && hasFrameAppearances(editedOf(componentName))
		)
	)

	const only = $derived(targets.length === 1 ? targets[0] : undefined)
	const hasInnerFrame = $derived(targets.some(({ frameId }) => frameId !== undefined))

	const write = (edits: AppearanceEdit[]) => {
		for (const [name, visualizer] of foldAppearanceEdits(edits)) {
			resourceAppearance.setSession(name, visualizer)
		}
	}

	const update = (patches: ResourceAppearancePatch[]) => {
		write(
			targets.map(({ componentName, frameId }, index) => ({
				component: editedOf(componentName),
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
			editedTargets.map(({ componentName, frameId }) => ({
				component: editedOf(componentName),
				edit: (current) =>
					frameId === undefined
						? withoutResourceAppearance(current)
						: withoutFrameAppearance(current, frameId),
			}))
		)
	}

	const handleResetChildren = () => {
		write(
			targetsWithEditedChildren.map(({ componentName }) => ({
				component: editedOf(componentName),
				edit: withoutFrameAppearances,
			}))
		)
	}
</script>

<div class="flex flex-col gap-2.5 pt-3">
	<p class="text-subtle-2">
		Not saved, and a reload drops these changes. Build mode saves an appearance to the config.
		{#if only?.frameId !== undefined && only}
			Values not changed here follow {only.componentName}.
		{:else if !only && hasInnerFrame}
			Values not changed here follow each frame's resource.
		{/if}
	</p>

	<AppearanceFields
		targets={fieldTargets}
		showsVisibility={false}
		onchange={update}
	/>

	{#if editedTargets.length > 0}
		<Button
			variant="ghost-outline"
			class="w-full"
			onclick={handleReset}
		>
			Reset appearance
		</Button>
	{/if}

	{#if targetsWithEditedChildren.length > 0}
		<Button
			variant="ghost-outline"
			class="w-full"
			onclick={handleResetChildren}
		>
			Reset children
		</Button>
	{/if}
</div>

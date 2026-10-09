<!--
@component

A part-owned resource's appearance while building, read from and written to its `visualizer`
config so the look is saved with the machine. A frame inside the resource, such as an obstacle's
shape, follows the resource's values and saves only what it changes. In monitor mode the same
controls edit the scene only, through `AppearanceDetails`.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { Button, Switch } from '@viamrobotics/prime-core'
	import {
		Color,
		type ColorChangeEvent,
		type ColorValueRgbObject,
		Slider,
		type SliderChangeEvent,
	} from 'svelte-tweakpane-ui'
	import { Color as ThreeColor } from 'three'

	import { colors } from '$lib/color'
	import { traits, useOpacity, useTrait } from '$lib/ecs'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import {
		frameAppearanceOf,
		hasFrameAppearances,
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

	const OPACITY_STEP = 0.01
	const OPACITY_DECIMALS = 2
	const AXES_HELPER_DEFAULT = true

	const partConfig = usePartConfig()

	const entityColor = useTrait(() => entity, traits.Color)
	const entityOpacity = useOpacity(() => entity)

	const own = $derived<ResourceAppearance>(
		frameId === undefined ? resourceAppearanceOf(component) : frameAppearanceOf(component, frameId)
	)
	const inherited = $derived<ResourceAppearance>(
		frameId === undefined ? {} : resourceAppearanceOf(component)
	)
	const isOwnSaved = $derived(Object.keys(own).length > 0)
	const hasSavedChildren = $derived(frameId === undefined && hasFrameAppearances(component))
	const axesHelperDefault = $derived(inherited.show_axes_helper ?? AXES_HELPER_DEFAULT)

	const colorValue = $derived.by<ColorValueRgbObject>(() => {
		const color = own.color ? new ThreeColor(own.color) : entityColor.current
		const { r, g, b } = color ?? new ThreeColor(colors.default)
		return { r, g, b }
	})

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

	const handleColorChange = (event: ColorChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const { r, g, b } = event.detail.value as ColorValueRgbObject
		update({ color: `#${new ThreeColor().setRGB(r, g, b).getHexString()}` })
	}

	const handleOpacityChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		update({ opacity: Number(event.detail.value.toFixed(OPACITY_DECIMALS)) })
	}

	const handleAxesHelperChange = (isShown: boolean) => {
		update({ show_axes_helper: isShown === axesHelperDefault ? undefined : isShown })
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

	<div>
		<strong class="font-semibold">color</strong>
		<div aria-label="saved color">
			<Color
				value={colorValue}
				type="float"
				on:change={handleColorChange}
			/>
		</div>
	</div>

	<div>
		<strong class="font-semibold">opacity</strong>
		<div aria-label="saved opacity">
			<Slider
				value={own.opacity ?? inherited.opacity ?? entityOpacity.current}
				min={0}
				max={1}
				step={OPACITY_STEP}
				format={(value) => value.toFixed(OPACITY_DECIMALS)}
				on:change={handleOpacityChange}
			/>
		</div>
	</div>

	<div class="flex items-center justify-between">
		<strong class="font-semibold">visible</strong>
		<Switch
			aria-label="visible"
			on={own.invisible !== true}
			on:change={(event) => update({ invisible: event.detail ? undefined : true })}
		/>
	</div>

	<div class="flex items-center justify-between">
		<strong class="font-semibold">show axes helper</strong>
		<Switch
			aria-label="show axes helper"
			on={own.show_axes_helper ?? axesHelperDefault}
			on:change={(event) => handleAxesHelperChange(event.detail)}
		/>
	</div>

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

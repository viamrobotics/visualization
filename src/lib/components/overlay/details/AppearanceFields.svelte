<script
	module
	lang="ts"
>
	import type { Entity } from 'koota'

	import type { ResourceAppearance } from '#lib/resourceAppearance.js'

	/** One selected frame being styled. */
	export interface AppearanceFieldsTarget {
		/** The frame. Its current color and opacity show for a key nothing sets. */
		entity: Entity
		/** What is set at this level of the appearance being edited. */
		values: ResourceAppearance
		/** What shows for a key `values` leaves unset, such as the resource a frame inside follows. */
		fallback: ResourceAppearance
	}
</script>

<script lang="ts">
	import { Slider } from '@viamrobotics/prime-controls'
	import { MathUtils, Color as ThreeColor } from 'three'

	import type { ResourceAppearancePatch } from '#lib/resourceAppearance.js'

	import { colors, parseRGB } from '#lib/color.js'
	import {
		DEFAULT_OPACITY,
		resolveOpacity,
		traits,
		useMappedEntitiesTraits,
	} from '#lib/ecs/index.js'

	import SharedColor from './SharedColor.svelte'
	import SharedSwitch from './SharedSwitch.svelte'
	import { MIXED, sharedNumber, sharedValue } from './sharedValue'

	interface Props {
		/** One per selected frame. Never empty. */
		targets: AppearanceFieldsTarget[]
		/** Whether to offer the visible switch, which saves a frame as hidden until shown. */
		showsVisibility: boolean
		/** Called with one patch per target, in the order of `targets`. */
		onchange: (patches: ResourceAppearancePatch[]) => void
	}

	const { targets, showsVisibility, onchange }: Props = $props()

	const OPACITY_STEP = 0.01
	const OPACITY_DECIMALS = 2
	const AXES_HELPER_DEFAULT = true
	const INVISIBLE_DEFAULT = false

	const entityLooks = useMappedEntitiesTraits(
		() => targets.map((target) => target.entity),
		[traits.Color, traits.Opacity, traits.OpacityOverride],
		(entity) => ({ color: entity.get(traits.Color), opacity: resolveOpacity(entity) })
	)

	const fallbackAxesHelperOf = (target: AppearanceFieldsTarget) =>
		target.fallback.show_axes_helper ?? AXES_HELPER_DEFAULT
	const fallbackInvisibleOf = (target: AppearanceFieldsTarget) =>
		target.fallback.invisible ?? INVISIBLE_DEFAULT

	// The picker works in sRGB hex. A three.js `Color` holds linear values, and `getHexString` converts.
	const pickerColors = $derived(
		targets.map((target, index) => {
			const hex = target.values.color ?? target.fallback.color
			const entityColor = entityLooks.current[index]?.color
			let color = new ThreeColor(colors.default)
			if (hex) {
				color = new ThreeColor(hex)
			} else if (entityColor) {
				color = parseRGB(entityColor)
			}
			return `#${color.getHexString()}`
		})
	)
	const color = $derived(sharedValue(pickerColors))

	const opacity = $derived(
		sharedNumber(
			targets.map(
				(target, index) =>
					target.values.opacity ??
					target.fallback.opacity ??
					entityLooks.current[index]?.opacity ??
					DEFAULT_OPACITY
			)
		)
	)
	const isVisible = $derived(
		sharedValue(targets.map((target) => !(target.values.invisible ?? fallbackInvisibleOf(target))))
	)
	const isAxesHelperShown = $derived(
		sharedValue(
			targets.map((target) => target.values.show_axes_helper ?? fallbackAxesHelperOf(target))
		)
	)

	// Clamped, because the slider's readout takes typed values outside its range.
	const writeOpacity = (next: number) => {
		const patch = { opacity: Number(MathUtils.clamp(next, 0, 1).toFixed(OPACITY_DECIMALS)) }
		onchange(targets.map(() => patch))
	}

	// A switch set back to what the fallback already gives clears the key, so the frame follows again.
	const handleVisibleChange = (isNextVisible: boolean) => {
		const isInvisible = !isNextVisible
		onchange(
			targets.map((target) => ({
				invisible: isInvisible === fallbackInvisibleOf(target) ? undefined : isInvisible,
			}))
		)
	}

	const handleAxesHelperChange = (isShown: boolean) => {
		onchange(
			targets.map((target) => ({
				show_axes_helper: isShown === fallbackAxesHelperOf(target) ? undefined : isShown,
			}))
		)
	}
</script>

{#if pickerColors[0]}
	<SharedColor
		label="color"
		value={color}
		mixedSeed={pickerColors[0]}
		onchange={(hex) => {
			const patch = { color: hex }
			onchange(targets.map(() => patch))
		}}
	/>
{/if}

<div>
	<strong class="font-semibold">opacity</strong>
	<!-- A mixed opacity has no single value, so the readout stays empty until the user picks one. -->
	<Slider
		aria-label="opacity"
		min={0}
		max={1}
		step={OPACITY_STEP}
		bind:value={() => (opacity === MIXED ? Number.NaN : opacity), writeOpacity}
	/>
</div>

{#if showsVisibility}
	<SharedSwitch
		label="visible"
		value={isVisible}
		onchange={handleVisibleChange}
	/>
{/if}

<SharedSwitch
	label="show axes helper"
	value={isAxesHelperShown}
	onchange={handleAxesHelperChange}
/>

<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import {
		Color,
		type ColorChangeEvent,
		type ColorValueRgbObject,
		Point,
		type PointValue3dObject,
		Slider,
		type SliderChangeEvent,
	} from 'svelte-tweakpane-ui'

	import { traits, useTrait } from '#lib/ecs/index.js'

	import {
		appendLinePosition as appendLinePositionPure,
		removeLinePosition as removeLinePositionPure,
		writeLinePosition as writeLinePositionPure,
	} from './linePositions'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { invalidate } = useThrelte()
	const linePositions = useTrait(() => entity, traits.LinePositions)
	const lineWidth = useTrait(() => entity, traits.LineWidth)
	const lineColor = useTrait(() => entity, traits.Color)
	const dotSize = useTrait(() => entity, traits.DotSize)
	const dotColors = useTrait(() => entity, traits.DotColors)

	const linePositionList = $derived.by<PointValue3dObject[]>(() => {
		const positions = linePositions.current
		if (!positions) return []
		const out: PointValue3dObject[] = []
		for (let i = 0; i + 2 < positions.length; i += 3) {
			out.push({ x: positions[i]!, y: positions[i + 1]!, z: positions[i + 2]! })
		}
		return out
	})

	const dotColorValue = $derived.by<ColorValueRgbObject | undefined>(() => {
		const colors = dotColors.current
		if (!colors || colors.length < 3) return undefined
		return { r: colors[0]! / 255, g: colors[1]! / 255, b: colors[2]! / 255 }
	})

	const writeLinePosition = (index: number, value: PointValue3dObject) => {
		const current = linePositions.current
		if (!current) return
		entity.set(
			traits.LinePositions,
			writeLinePositionPure(current, index, value.x, value.y, value.z)
		)
		invalidate()
	}

	const appendLinePosition = () => {
		entity.set(
			traits.LinePositions,
			appendLinePositionPure(linePositions.current ?? new Float32Array())
		)
		invalidate()
	}

	const removeLinePosition = (index: number) => {
		const current = linePositions.current
		if (!current) return
		const next = removeLinePositionPure(current, index)
		if (next === current) return
		entity.set(traits.LinePositions, next)
		invalidate()
	}

	const handleLineWidthChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		entity.set(traits.LineWidth, event.detail.value)
		invalidate()
	}

	const handleLineColorChange = (event: ColorChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as ColorValueRgbObject
		entity.set(traits.Color, { r: next.r, g: next.g, b: next.b })
		invalidate()
	}

	const handleDotSizeChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		entity.set(traits.DotSize, event.detail.value)
		invalidate()
	}

	const handleDotColorChange = (event: ColorChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as ColorValueRgbObject
		entity.set(
			traits.DotColors,
			new Uint8Array([Math.round(next.r * 255), Math.round(next.g * 255), Math.round(next.b * 255)])
		)
		invalidate()
	}
</script>

{#if linePositions.current}
	<details>
		<summary class="cursor-pointer select-none">
			<strong class="font-semibold">line positions</strong>
			<span class="text-subtle-2">(m, {linePositionList.length})</span>
		</summary>
		<div
			aria-label="mutable line positions"
			class="mt-1"
		>
			<div class="flex max-h-48 flex-col gap-1 overflow-y-auto">
				{#each linePositionList as position, index (index)}
					<div class="flex items-end gap-1">
						<div class="flex-1">
							<Point
								value={position}
								on:change={(event) => {
									if (event.detail.origin !== 'internal') return
									writeLinePosition(index, event.detail.value as PointValue3dObject)
								}}
							/>
						</div>
						<button
							class="text-subtle-2 px-1 py-0.5 text-[10px] hover:text-red-500"
							type="button"
							aria-label={`remove position ${index + 1}`}
							disabled={linePositionList.length <= 2}
							onclick={() => removeLinePosition(index)}
						>
							×
						</button>
					</div>
				{/each}
			</div>
			<button
				class="border-medium hover:bg-light mt-1 border px-2 py-1 text-xs"
				type="button"
				onclick={appendLinePosition}
			>
				Add position
			</button>
		</div>
	</details>

	<div>
		<strong class="font-semibold">line width</strong>
		<Slider
			value={lineWidth.current ?? 5}
			min={0.1}
			max={50}
			step={0.1}
			on:change={handleLineWidthChange}
		/>
	</div>

	{#if lineColor.current}
		<div>
			<strong class="font-semibold">line color</strong>
			<Color
				value={lineColor.current}
				type="float"
				on:change={handleLineColorChange}
			/>
		</div>
	{/if}

	<div>
		<strong class="font-semibold">dot size</strong>
		<Slider
			value={dotSize.current ?? 10}
			min={0}
			max={50}
			step={0.1}
			on:change={handleDotSizeChange}
		/>
	</div>

	{#if dotColorValue}
		<div>
			<strong class="font-semibold">dot color</strong>
			<Color
				value={dotColorValue}
				type="float"
				on:change={handleDotColorChange}
			/>
		</div>
	{/if}
{/if}

<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'
	import { Point, type PointValue, Slider } from '@viamrobotics/prime-controls'

	import { rgbToHex } from '#lib/color.js'
	import { traits, useTrait } from '#lib/ecs/index.js'

	import { colorChannelsToHex, hexToColorChannels } from '../colorChannelsHex'
	import SharedColor from '../SharedColor.svelte'
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

	const linePositionList = $derived.by<Required<Omit<PointValue, 'w'>>[]>(() => {
		const positions = linePositions.current
		if (!positions) return []
		const out: Required<Omit<PointValue, 'w'>>[] = []
		for (let i = 0; i + 2 < positions.length; i += 3) {
			out.push({ x: positions[i]!, y: positions[i + 1]!, z: positions[i + 2]! })
		}
		return out
	})

	const dotColorHex = $derived.by<string | undefined>(() => {
		const colors = dotColors.current
		if (!colors || colors.length < 3) return undefined
		return rgbToHex(colors)
	})

	const writeLinePosition = (index: number, value: PointValue) => {
		const current = linePositions.current
		if (!current) return
		entity.set(
			traits.LinePositions,
			writeLinePositionPure(current, index, value.x, value.y, value.z ?? 0)
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

	const writeLineWidth = (next: number) => {
		entity.set(traits.LineWidth, next)
		invalidate()
	}

	const writeLineColor = (hex: string) => {
		entity.set(traits.Color, hexToColorChannels(hex))
		invalidate()
	}

	const writeDotSize = (next: number) => {
		entity.set(traits.DotSize, next)
		invalidate()
	}

	const writeDotColor = (hex: string) => {
		const { r, g, b } = hexToColorChannels(hex)
		entity.set(
			traits.DotColors,
			new Uint8Array([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)])
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
		<div class="mt-1">
			<div class="flex max-h-48 flex-col gap-1 overflow-y-auto">
				{#each linePositionList as position, index (index)}
					<div class="flex items-end gap-1">
						<Point
							aria-label={`position ${index + 1} (m)`}
							class="flex-1"
							step={0.01}
							bind:value={() => position, (next) => writeLinePosition(index, next)}
						/>
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
			aria-label="line width"
			min={0.1}
			max={50}
			step={0.1}
			bind:value={() => lineWidth.current ?? 5, writeLineWidth}
		/>
	</div>

	{#if lineColor.current}
		{@const lineHex = colorChannelsToHex(lineColor.current)}
		<SharedColor
			label="line color"
			value={lineHex}
			mixedSeed={lineHex}
			onchange={writeLineColor}
		/>
	{/if}

	<div>
		<strong class="font-semibold">dot size</strong>
		<Slider
			aria-label="dot size"
			min={0}
			max={50}
			step={0.1}
			bind:value={() => dotSize.current ?? 10, writeDotSize}
		/>
	</div>

	{#if dotColorHex}
		<SharedColor
			label="dot color"
			value={dotColorHex}
			mixedSeed={dotColorHex}
			onchange={writeDotColor}
		/>
	{/if}
{/if}

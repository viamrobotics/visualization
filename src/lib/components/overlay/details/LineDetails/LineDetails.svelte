<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'
	import { Slider } from '@viamrobotics/prime-controls'
	import { MathUtils } from 'three'

	import { rgbToHex } from '#lib/color.js'
	import { traits, useTrait } from '#lib/ecs/index.js'

	import { colorChannelsToHex, hexToColorChannels } from '../colorChannelsHex'
	import SharedColor from '../SharedColor.svelte'
	import SharedNumberFields from '../SharedNumberFields.svelte'
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

	interface LinePosition {
		x: number
		y: number
		z: number
	}

	const POSITION_FIELDS = [
		{ key: 'x', label: 'X' },
		{ key: 'y', label: 'Y' },
		{ key: 'z', label: 'Z' },
	] as const

	const linePositionList = $derived.by<LinePosition[]>(() => {
		const positions = linePositions.current
		if (!positions) return []
		const out: LinePosition[] = []
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

	const writeLinePosition = (index: number, value: LinePosition) => {
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

	const LINE_WIDTH = { min: 0.1, max: 50, default: 5 }
	const DOT_SIZE = { min: 0, max: 50, default: 10 }

	// The sizes are clamped, because a slider's readout takes typed values outside its range.
	const writeLineWidth = (next: number) => {
		entity.set(traits.LineWidth, MathUtils.clamp(next, LINE_WIDTH.min, LINE_WIDTH.max))
		invalidate()
	}

	const writeLineColor = (hex: string) => {
		entity.set(traits.Color, hexToColorChannels(hex))
		invalidate()
	}

	const writeDotSize = (next: number) => {
		entity.set(traits.DotSize, MathUtils.clamp(next, DOT_SIZE.min, DOT_SIZE.max))
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
						<div class="min-w-0 flex-1">
							<SharedNumberFields
								aria-label={`position ${index + 1} (m)`}
								fields={POSITION_FIELDS}
								values={position}
								step={0.01}
								onchange={(patch) => writeLinePosition(index, { ...position, ...patch })}
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
			aria-label="line width"
			min={LINE_WIDTH.min}
			max={LINE_WIDTH.max}
			step={0.1}
			bind:value={() => lineWidth.current ?? LINE_WIDTH.default, writeLineWidth}
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
			min={DOT_SIZE.min}
			max={DOT_SIZE.max}
			step={0.1}
			bind:value={() => dotSize.current ?? DOT_SIZE.default, writeDotSize}
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

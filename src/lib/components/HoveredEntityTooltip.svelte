<script
	module
	lang="ts"
>
	import { Vector3 } from 'three'

	interface ClosestArrow {
		index: number
		x: number
		y: number
		z: number
		oX: number
		oY: number
		oZ: number
	}

	interface ClosestPoint {
		index: number
		x: number
		y: number
		z: number
	}

	const getClosestArrow = (positions: Float32Array, point: Vector3): ClosestArrow => {
		let smallestDistance = Infinity
		let index = -1

		for (let i = 0; i < positions.length; i += 6) {
			const x = positions[i] / 1000
			const y = positions[i + 1] / 1000
			const z = positions[i + 2] / 1000

			const distance = point.distanceToSquared(new Vector3(x, y, z))

			if (distance < smallestDistance) {
				smallestDistance = distance
				index = i
			}
		}

		return {
			index: Math.floor(index / 6),
			x: positions[index] / 1000,
			y: positions[index + 1] / 1000,
			z: positions[index + 2] / 1000,
			oX: positions[index + 3],
			oY: positions[index + 4],
			oZ: positions[index + 5],
		}
	}

	const getClosestPoint = (positions: Float32Array, point: Vector3): ClosestPoint => {
		let smallestDistance = Infinity
		let index = -1

		for (let i = 0; i < positions.length; i += 3) {
			const x = positions[i]
			const y = positions[i + 1]
			const z = positions[i + 2]

			const distance = point.distanceToSquared(new Vector3(x, y, z))

			if (distance < smallestDistance) {
				smallestDistance = distance
				index = i
			}
		}

		return {
			index: Math.floor(index / 3),
			x: positions[index],
			y: positions[index + 1],
			z: positions[index + 2],
		}
	}

	const getPointAtIndex = (positions: Float32Array, index: number): ClosestPoint => ({
		index,
		x: positions[index * 3],
		y: positions[index * 3 + 1],
		z: positions[index * 3 + 2],
	})
</script>

<script lang="ts">
	import { traits } from '$lib/ecs'
	import { HTML } from '@threlte/extras'
	import type { Entity } from 'koota'
	import { useWorld } from '$lib/ecs'
	import { onDestroy } from 'svelte'

	interface Props {
		hoveredEntity: Entity
	}

	let { hoveredEntity }: Props = $props()

	const world = useWorld()

	let tooltipData: { subEntityPosition: Vector3 | undefined; closestArrow?: ClosestArrow; closestPoint?: ClosestPoint } | null = $state.raw(null)

	const getTooltipData = (entity: Entity) => {
		if (entity !== hoveredEntity) {
			return null
		}

		const hover = entity.get(traits.Hover)
		if (!hover) return null

		const hoverPosition = new Vector3(hover.x, hover.y, hover.z)
		const index = hover.index >= 0 ? hover.index : undefined

		let closestArrow: ClosestArrow | undefined
		let closestPoint: ClosestPoint | undefined
		let subEntityPosition: Vector3 | undefined;

		if (entity.has(traits.Arrows)) {
			// TODO: maybe we could store the arrows in a buffered geometry to avoid the slow getClosestArrow
			closestArrow = getClosestArrow(entity.get(traits.Positions) as Float32Array, hoverPosition)
			subEntityPosition = new Vector3(closestArrow.x, closestArrow.y, closestArrow.z)
		} else if (entity.has(traits.Points)) {
			const positions = entity.get(traits.BufferGeometry)?.attributes.position
				.array as Float32Array

			// we can skip the slow getClosestPoint if the points provided an index already
			if (index !== undefined) {
				closestPoint = getPointAtIndex(positions, index)
			} else {
				closestPoint = getClosestPoint(positions, hoverPosition)
			}
			subEntityPosition = new Vector3(closestPoint.x, closestPoint.y, closestPoint.z)
		}
		return { subEntityPosition, closestArrow, closestPoint }
	}

	const unsubChange = world.onChange(traits.Hover, (entity) => {
		if (entity === hoveredEntity) {
		   tooltipData = getTooltipData(entity);
		}
	})

	const unsubRemove = world.onRemove(traits.Hover, (entity) => {
		if (entity === hoveredEntity) {
			tooltipData = null
		}
	})

	onDestroy(() => {
		unsubChange()
		unsubRemove()
	})
</script>


{#if tooltipData?.subEntityPosition}
	<HTML
		position={tooltipData.subEntityPosition.toArray()}
		class="pointer-events-none"
	>
		<div
			class="border-medium pointer-events-none relative -mb-2 -translate-x-1/2 -translate-y-full border bg-white px-3 py-2.5 text-xs shadow-md"
		>
			<!-- Arrow -->
			<div
				class="border-medium absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-r border-b bg-white"
			></div>

			<div class="flex flex-col gap-2.5">
				{#if tooltipData.closestArrow}
					<div>
						<div class="mb-1"><strong class="font-semibold">index</strong></div>
						<div>{tooltipData.closestArrow.index}</div>
					</div>

					<div>
						<div class="mb-1">
							<strong class="font-semibold">world position</strong>
							<span class="text-subtle-2"> (m)</span>
						</div>
						<div class="flex gap-3">
							<div><span class="text-subtle-2 mr-1">x </span>{tooltipData.closestArrow.x.toFixed(2)}</div>
							<div><span class="text-subtle-2 mr-1">y </span>{tooltipData.closestArrow.y.toFixed(2)}</div>
							<div><span class="text-subtle-2 mr-1">z </span>{tooltipData.closestArrow.z.toFixed(2)}</div>
						</div>
					</div>

					<div>
						<div class="mb-1">
							<strong class="font-semibold">world orientation</strong>
							<span class="text-subtle-2"> (deg)</span>
						</div>
						<div class="flex gap-3">
							<div><span class="text-subtle-2 mr-1">x </span>{tooltipData.closestArrow.oX.toFixed(2)}</div>
							<div><span class="text-subtle-2 mr-1">y </span>{tooltipData.closestArrow.oY.toFixed(2)}</div>
							<div><span class="text-subtle-2 mr-1">z </span>{tooltipData.closestArrow.oZ.toFixed(2)}</div>
						</div>
					</div>
				{/if}

				{#if tooltipData.closestPoint}
					<div>
						<div class="mb-1"><strong class="font-semibold">index</strong></div>
						<div>{tooltipData.closestPoint.index}</div>
					</div>

					<div>
						<div class="mb-1">
							<strong class="font-semibold">world position</strong>
							<span class="text-subtle-2"> (m)</span>
						</div>
						<div class="flex gap-3">
							<div><span class="text-subtle-2">x </span>{tooltipData.closestPoint.x.toFixed(2)}</div>
							<div><span class="text-subtle-2">y </span>{tooltipData.closestPoint.y.toFixed(2)}</div>
							<div><span class="text-subtle-2">z </span>{tooltipData.closestPoint.z.toFixed(2)}</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</HTML>
{/if}

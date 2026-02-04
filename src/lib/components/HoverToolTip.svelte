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
			index: Math.floor(index/6),
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
			index: Math.floor(index/3),
			x: positions[index],
			y: positions[index + 1],
			z: positions[index + 2],
		}
	}
</script>

<script lang="ts">
	import { HTML } from '@threlte/extras'
	import { useSelectedEntity, useFocusedEntity } from '$lib/hooks/useSelection.svelte'
	import { useHoverInfo } from '$lib/hooks/useHoverPosition.svelte'
	import { traits } from '$lib/ecs'

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const hoverInfo = useHoverInfo()

	const entity = $derived(focusedEntity.current ?? selectedEntity.current)

	let closestArrow = $state<ClosestArrow | undefined>(undefined)
	let closestPoint = $state<ClosestPoint | undefined>(undefined)

	$effect(() => {
		if (entity?.has(traits.Arrows)) {
            closestPoint = undefined
			if (hoverInfo.position) {
				closestArrow = getClosestArrow(
					entity?.get(traits.Positions) as Float32Array,
					hoverInfo.position
				)
			}
		} else if (entity?.has(traits.Points)) {
			closestArrow = undefined
			if (hoverInfo.position) {
				closestPoint = getClosestPoint(
					entity?.get(traits.BufferGeometry)?.attributes.position.array as Float32Array,
					hoverInfo.position
				)
			}
		}
	})
</script>

{#if closestArrow && entity === hoverInfo.entity}
	<HTML position={[closestArrow?.x, closestArrow?.y, closestArrow?.z]}>
		<div
			class="w-56 space-y-2 rounded border border-gray-300 bg-white px-3 py-2 text-xs shadow-md"
		>
			<div class="flex items-center gap-2">
				<span class="font-semibold text-gray-600">Index:</span>
				<span class="font-mono">{closestArrow.index}</span>
			</div>

			<div class="space-y-1">
				<div class="pb-1 font-semibold text-gray-600">World Position (m)</div>
				<div class="flex gap-4 font-mono">
					<span><span class="text-gray-500">X:</span> {closestArrow.x.toFixed(2)}</span>
					<span><span class="text-gray-500">Y:</span> {closestArrow.y.toFixed(2)}</span>
					<span><span class="text-gray-500">Z:</span> {closestArrow.z.toFixed(2)}</span>
				</div>
			</div>

			<div class="space-y-1">
				<div class="pb-1 font-semibold text-gray-600">World Orientation (deg)</div>
				<div class="flex gap-4 font-mono">
					<span><span class="text-gray-500">oX:</span> {closestArrow.oX.toFixed(2)}</span>
					<span><span class="text-gray-500">oY:</span> {closestArrow.oY.toFixed(2)}</span>
					<span><span class="text-gray-500">oZ:</span> {closestArrow.oZ.toFixed(2)}</span>
				</div>
			</div>
		</div>
	</HTML>
{/if}

{#if closestPoint && entity === hoverInfo.entity}
	<HTML position={[closestPoint?.x, closestPoint?.y, closestPoint?.z]}>
		<div
			class="w-56 space-y-2 rounded border border-gray-300 bg-white px-3 py-2 text-xs shadow-md"
		>
			<div class="flex items-center gap-2">
				<span class="font-semibold text-gray-600">Index:</span>
				<span class="font-mono">{closestPoint.index}</span>
			</div>

			<div class="space-y-1">
				<div class="pb-1 font-semibold text-gray-600">World Position (m)</div>
				<div class="flex gap-4 font-mono">
					<span><span class="text-gray-500">X:</span> {closestPoint.x.toFixed(2)}</span>
					<span><span class="text-gray-500">Y:</span> {closestPoint.y.toFixed(2)}</span>
					<span><span class="text-gray-500">Z:</span> {closestPoint.z.toFixed(2)}</span>
				</div>
			</div>
		</div>
	</HTML>
{/if}


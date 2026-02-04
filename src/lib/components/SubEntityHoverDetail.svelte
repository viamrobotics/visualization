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

	const getPointAtIndex = (positions: Float32Array, index: number): ClosestPoint => ({
		index,
		x: positions[index * 3],
		y: positions[index * 3 + 1],
		z: positions[index * 3 + 2],
	})
</script>

<script lang="ts">
	import { useSelectedEntity, useFocusedEntity } from '$lib/hooks/useSelection.svelte'
	import { useHoverInfo } from '$lib/hooks/useHoverInfo.svelte'
	import { traits } from '$lib/ecs'

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const hoverInfo = useHoverInfo()

	const entity = $derived(focusedEntity.current ?? selectedEntity.current)

	let closestArrow = $state<ClosestArrow | undefined>(undefined)
	let closestPoint = $state<ClosestPoint | undefined>(undefined)

	const findClosestArrow = () => {
		if (!entity?.has(traits.Arrows) || !hoverInfo.position) {
			return undefined
		}
		// TODO: maybe we could store the arrows in a buffered geometry to avoid the slow getClosestArrow
		return getClosestArrow(entity.get(traits.Positions) as Float32Array, hoverInfo.position)
	}

	const findClosestPoint = () => {
		if (!entity?.has(traits.Points) || !hoverInfo.position) {
			return undefined
		}

		const positions = entity.get(traits.BufferGeometry)?.attributes.position.array as Float32Array

		// we can skip the slow getClosestPoint if the points provided an index already
		if (hoverInfo.index !== undefined) {
			return getPointAtIndex(positions, hoverInfo.index)
		}

		return getClosestPoint(positions, hoverInfo.position)
	}

	$effect(() => {
		closestArrow = findClosestArrow()
		closestPoint = findClosestPoint()
	})
</script>

{#if entity === hoverInfo.entity}
    <h3 class="text-subtle-2 pt-3 pb-2">Sub-entity Hover Info</h3>
    
	{#if closestArrow}
		<div>
			<strong class="font-semibold">index</strong>
			<div>{closestArrow.index}</div>
		</div>

		<div>
			<strong class="font-semibold">world position</strong>
			<span class="text-subtle-2">(m)</span>
			<div class="flex gap-3">
				<div>
					<span class="text-subtle-2">x</span>
					{closestArrow.x.toFixed(2)}
				</div>
				<div>
					<span class="text-subtle-2">y</span>
					{closestArrow.y.toFixed(2)}
				</div>
				<div>
					<span class="text-subtle-2">z</span>
					{closestArrow.z.toFixed(2)}
				</div>
			</div>
		</div>

		<div>
			<strong class="font-semibold">world orientation</strong>
			<span class="text-subtle-2">(deg)</span>
			<div class="flex gap-3">
				<div>
					<span class="text-subtle-2">x</span>
					{closestArrow.oX.toFixed(2)}
				</div>
				<div>
					<span class="text-subtle-2">y</span>
					{closestArrow.oY.toFixed(2)}
				</div>
				<div>
					<span class="text-subtle-2">z</span>
					{closestArrow.oZ.toFixed(2)}
				</div>
			</div>
		</div>
	{/if}

	{#if closestPoint}
		<div>
			<strong class="font-semibold">index</strong>
			<div>{closestPoint.index}</div>
		</div>

		<div>
			<strong class="font-semibold">world position</strong>
			<span class="text-subtle-2">(m)</span>
			<div class="flex gap-3">
				<div>
					<span class="text-subtle-2">x</span>
					{closestPoint.x.toFixed(2)}
				</div>
				<div>
					<span class="text-subtle-2">y</span>
					{closestPoint.y.toFixed(2)}
				</div>
				<div>
					<span class="text-subtle-2">z</span>
					{closestPoint.z.toFixed(2)}
				</div>
			</div>
		</div>
	{/if}
{/if}



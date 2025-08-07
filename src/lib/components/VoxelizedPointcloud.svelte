<script
	module
	lang="ts"
>
	import { BufferAttribute, BufferGeometry, LOD, Points, PointsMaterial } from 'three'

	const voxelSimplifyPoints = ({
		positions,
		colors,
		voxelSize,
	}: {
		positions: Float32Array
		colors?: Float32Array
		voxelSize: number
	}) => {
		const voxelMap = new Map<string, number[]>()

		for (let i = 0; i < positions.length; i += 3) {
			const x = Math.floor(positions[i] / voxelSize)
			const y = Math.floor(positions[i + 1] / voxelSize)
			const z = Math.floor(positions[i + 2] / voxelSize)
			const key = `${x},${y},${z}`

			if (!voxelMap.has(key)) voxelMap.set(key, [])
			voxelMap.get(key)?.push(i)
		}

		const voxelCount = voxelMap.size
		const filteredPositions: Float32Array<ArrayBuffer> = new Float32Array(voxelCount * 3)
		const filteredColors: Float32Array<ArrayBuffer> | null = colors
			? new Float32Array(voxelCount * 3)
			: null

		let j = 0
		voxelMap.forEach((indices) => {
			let px = 0
			let py = 0
			let pz = 0
			let cr = 0
			let cg = 0
			let cb = 0

			const count = indices.length
			indices.forEach((index) => {
				px += positions[index]
				py += positions[index + 1]
				pz += positions[index + 2]
				if (colors) {
					cr += colors[index]
					cg += colors[index + 1]
					cb += colors[index + 2]
				}
			})

			filteredPositions[j] = px / count
			filteredPositions[j + 1] = py / count
			filteredPositions[j + 2] = pz / count

			if (filteredColors) {
				filteredColors[j] = cr / count
				filteredColors[j + 1] = cg / count
				filteredColors[j + 2] = cb / count
			}

			j += 3
		})

		return [filteredPositions, filteredColors] as const
	}
</script>

<script lang="ts">
	import { T } from '@threlte/core'
	import type { WorldObject } from '$lib/WorldObject'

	interface Props {
		object: WorldObject<{ case: 'points'; value: Float32Array<ArrayBuffer> }>
	}

	let { object }: Props = $props()

	const lod = new LOD()

	const voxelSizes = [0.5, 1.0, 2.0, 4.0] // adjust as needed
	const thresholds = [10, 20, 40, 80] // distances at which to switch LODs

	voxelSizes.forEach((voxelSize, i) => {
		const [filteredPositions, filteredColors] = voxelSimplifyPoints({
			positions: object.geometry?.value ?? new Float32Array(),
			colors: object.metadata.colors,
			voxelSize,
		})

		const material = new PointsMaterial({
			size: 0.1 * (i + 1), // optional visual scaling
			vertexColors: object.metadata.colors !== undefined,
		})

		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new BufferAttribute(filteredPositions, 3))

		if (filteredColors) {
			geometry.setAttribute('color', new BufferAttribute(filteredColors, 3))
			geometry.attributes.color.needsUpdate = true
		}

		const points = new Points(geometry, material)
		lod.addLevel(points, thresholds[i])
	})
</script>

<T is={lod} />

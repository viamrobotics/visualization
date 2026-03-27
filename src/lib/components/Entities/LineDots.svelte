<script lang="ts">
	import { T } from '@threlte/core'
	import { BatchedMesh, Color, Matrix4, SphereGeometry, Vector3 } from 'three'

	import { isSingleColor, isVertexColors } from '$lib/buffer'

	interface Props {
		colors: Uint8Array<ArrayBuffer>
		positions: Float32Array
		scale: number
	}

	let { colors, positions, scale }: Props = $props()

	const geometry = new SphereGeometry(0.5, 16, 16)
	const vertexCount = geometry.getAttribute('position').count
	const indexCount = geometry.index?.count ?? vertexCount
	const mesh = new BatchedMesh(5000, vertexCount, indexCount)
	const matrix = new Matrix4()
	const vec3 = new Vector3()
	const threeColor = new Color()

	const geometryID = mesh.addGeometry(geometry)

	const isPerDot = $derived(isVertexColors(colors))

	// TODO: We can remove this when we are consistently using 0-255 color scaling
	const uniformColor = $derived.by<[number, number, number]>(() => {
		if (!isSingleColor(colors)) return [0, 0, 0.55]
		return [colors[0]! / 255, colors[1]! / 255, colors[2]! / 255]
	})

	$effect(() => {
		for (let i = 0, l = positions.length; i < l; i += 3) {
			const dotIndex = i / 3
			const instance = mesh.addInstance(geometryID)
			matrix.makeTranslation(positions[i + 0], positions[i + 1], positions[i + 2])
			matrix.scale(vec3.setScalar(scale))
			mesh.setMatrixAt(instance, matrix)

			if (isPerDot) {
				const ci = dotIndex * 4
				threeColor.setRGB(colors[ci]! / 255, colors[ci + 1]! / 255, colors[ci + 2]! / 255)
				mesh.setColorAt(instance, threeColor)
			}
		}

		return () => {
			for (let i = 0, l = positions.length / 3; i < l; i += 1) {
				mesh.deleteInstance(i)
			}
		}
	})
</script>

<T
	is={mesh}
	frustumCulled={false}
	bvh={{ enabled: false }}
	raycast={() => null}
>
	<T.MeshBasicMaterial
		color={uniformColor}
		vertexColors={isPerDot}
	/>
</T>

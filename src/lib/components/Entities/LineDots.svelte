<script
	lang="ts"
	module
>
	const matrix = new Matrix4()
	const vec3 = new Vector3()
	const threeColor = new Color()
	const rgb = { r: 0, g: 0, b: 0 }
</script>

<script lang="ts">
	import { T } from '@threlte/core'
	import { BatchedMesh, Color, Matrix4, SphereGeometry, Vector3 } from 'three'

	import { asColor, asRGB, isSingleColor, isVertexColors, STRIDE } from '#lib/buffer.js'

	interface Props {
		colors: Uint8Array
		opacity: number
		positions: Float32Array
		scale: number
	}

	let { colors, opacity, positions, scale }: Props = $props()

	const geometry = new SphereGeometry(0.5, 16, 16)
	const vertexCount = geometry.getAttribute('position').count
	const indexCount = geometry.index?.count ?? vertexCount
	const mesh = new BatchedMesh(5000, vertexCount, indexCount)

	const geometryID = mesh.addGeometry(geometry)

	const isPerDot = $derived(isVertexColors(colors))

	const meshColor = $derived.by<[number, number, number]>(() => {
		if (isPerDot) return [1, 1, 1]
		if (!isSingleColor(colors)) return [0, 0, 0.55]
		asRGB(colors, rgb)
		return [rgb.r, rgb.g, rgb.b]
	})

	$effect(() => {
		if (!positions) return
		// Track the IDs `addInstance` returns rather than assuming they're a
		// sequential 0..N-1 range — when positions changes (e.g. a line gizmo
		// being placed), cleanup-by-index would target slots that were never
		// allocated for this effect run and throw "Invalid instanceId".
		const instances: number[] = []
		for (let i = 0, l = positions.length; i < l; i += 3) {
			const dotIndex = i / 3
			const instance = mesh.addInstance(geometryID)
			instances.push(instance)
			matrix.makeTranslation(positions[i + 0], positions[i + 1], positions[i + 2])
			matrix.scale(vec3.setScalar(scale))
			mesh.setMatrixAt(instance, matrix)

			if (isPerDot) {
				asColor(colors, threeColor, dotIndex * STRIDE.COLORS_RGB)
				mesh.setColorAt(instance, threeColor)
			}
		}

		return () => {
			for (const instance of instances) {
				mesh.deleteInstance(instance)
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
		color={meshColor}
		transparent={opacity < 1}
		{opacity}
	/>
</T>

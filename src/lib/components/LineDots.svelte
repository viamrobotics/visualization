<script lang="ts">
	import { T } from '@threlte/core'
	import { BatchedMesh, Matrix4, SphereGeometry, Vector3 } from 'three'

	interface Props {
		color: [number, number, number]
		positions: Float32Array
		scale: number
	}

	let { color, positions, scale }: Props = $props()

	const geometry = new SphereGeometry(1, 16, 16)
	const vertexCount = geometry.getAttribute('position').count
	const indexCount = geometry.index?.count ?? vertexCount
	const mesh = new BatchedMesh(5000, vertexCount, indexCount)
	const matrix = new Matrix4()
	const vec3 = new Vector3()

	const geometryID = mesh.addGeometry(geometry)

	$effect(() => {
		for (let i = 0, l = positions.length; i < l; i += 3) {
			const instance = mesh.addInstance(geometryID)
			matrix.makeTranslation(positions[i + 0], positions[i + 1], positions[i + 2])
			matrix.scale(vec3.setScalar(scale))
			mesh.setMatrixAt(instance, matrix)
		}

		return () => {
			for (let i = 0, l = positions.length; i < l; i += 1) {
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
	<T.MeshBasicMaterial {color} />
</T>

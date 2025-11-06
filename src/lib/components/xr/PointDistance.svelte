<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import Draggable from './Draggable.svelte'
	import { Mesh, Vector3 } from 'three'
	import { Text, Billboard } from '@threlte/extras'

	const mesh1 = new Mesh()
	const mesh2 = new Mesh()
	const distance = new Vector3()
	const midpoint = new Vector3()

	const pos1 = new Vector3()
	const pos2 = new Vector3()

	let text = $state('')
	let textPosition = $state<[number, number, number]>([0, 0, 0])

	useTask(() => {
		distance.subVectors(mesh1.getWorldPosition(pos1), mesh2.getWorldPosition(pos2))
		midpoint.addVectors(mesh1.getWorldPosition(pos1), mesh2.getWorldPosition(pos2)).divideScalar(2)
		textPosition = midpoint.toArray()

		const x = (distance.x ?? 0).toFixed(3)
		const y = (distance.y ?? 0).toFixed(3)
		const z = (distance.z ?? 0).toFixed(3)
		text = `${x},${y},${z}`
	})
</script>

<T.Group position={[-1, 1, 0]}>
	<Draggable onPointerEnter={() => null}>
		<T is={mesh1}>
			<T.SphereGeometry args={[0.05]} />
			<T.MeshStandardMaterial />
		</T>
	</Draggable>
</T.Group>

<T.Group position={textPosition}>
	<Billboard>
		<Text {text} />
	</Billboard>
</T.Group>

<T.Group position={[-1.5, 1, 0]}>
	<Draggable>
		<T is={mesh2}>
			<T.SphereGeometry args={[0.05]} />
			<T.MeshStandardMaterial />
		</T>
	</Draggable>
</T.Group>

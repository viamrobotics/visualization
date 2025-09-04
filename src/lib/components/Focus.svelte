<script lang="ts">
	import { T } from '@threlte/core'
	import { TrackballControls, Gizmo } from '@threlte/extras'
	import { Box3, type Object3D, Vector3 } from 'three'
	import Camera from './Camera.svelte'

	interface Props {
		object3d: Object3D
	}

	let { object3d }: Props = $props()

	const box = new Box3()
	const vec = new Vector3()

	let center = $state.raw<[number, number, number]>([0, 0, 0])
	let size = $state.raw<[number, number, number]>([0, 0, 0])

	$effect.pre(() => {
		box.setFromObject(object3d)
		size = box.getSize(vec).toArray()
		center = box.getCenter(vec).toArray()
	})
</script>

<Camera position={[size[0] + 1, size[0] + 1, size[0] + 1]}>
	<TrackballControls target={center}>
		<Gizmo />
	</TrackballControls>
</Camera>

<T
	is={object3d}
	bvh={{ maxDepth: 40, maxLeafTris: 20 }}
/>

<T.BoxHelper
	args={[object3d, 'red']}
	bvh={{ enabled: false }}
	raycast={() => null}
/>

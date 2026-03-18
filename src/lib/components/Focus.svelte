<script lang="ts">
	import { T } from '@threlte/core'
	import { Gizmo, Portal, TrackballControls } from '@threlte/extras'
	import { Box3, type Object3D, Vector3 } from 'three'
	import { TrackballControls as ThreeTrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'

	import Button from '$lib/components/overlay/dashboard/Button.svelte'

	import Camera from './Camera.svelte'

	interface Props {
		object3d: Object3D
	}

	let { object3d }: Props = $props()

	const box = new Box3()
	const vec = new Vector3()

	let center = $state.raw<[number, number, number]>([0, 0, 0])
	let size = $state.raw<[number, number, number]>([0, 0, 0])

	let controls = $state.raw<ThreeTrackballControls>()

	$effect.pre(() => {
		box.setFromObject(object3d)
		size = box.getSize(vec).toArray()
		center = box.getCenter(vec).toArray()
	})
</script>

<Portal id="dashboard">
	<fieldset>
		<Button
			active
			icon="camera-outline"
			description="Reset camera"
			onclick={() => {
				controls?.reset()
			}}
		/>
	</fieldset>
</Portal>

<Camera position={[size[0] + 1, size[0] + 1, size[0] + 1]}>
	<TrackballControls
		bind:ref={controls}
		target={center}
	>
		<Gizmo placement="bottom-right" />
	</TrackballControls>
</Camera>

<T is={object3d} />

<T.BoxHelper
	args={[object3d, 'red']}
	bvh={{ enabled: false }}
	raycast={() => null}
/>

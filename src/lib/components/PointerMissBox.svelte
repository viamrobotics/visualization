<script lang="ts">
	import { BackSide, Vector3 } from 'three'
	import { T, useThrelte } from '@threlte/core'
	import { MeshDiscardMaterial } from '@threlte/extras'
	import { useSelected } from '$lib/hooks/useSelection.svelte'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'

	const { camera } = useThrelte()
	const selected = useSelected()
	const transformControls = useTransformControls()
	const cameraDown = new Vector3()

	const size = 1_000
</script>

<T.Mesh
	onpointerdown={() => {
		cameraDown.copy(camera.current.position)
	}}
	onpointerup={() => {
		if (transformControls.active) {
			return
		}

		if (cameraDown.distanceToSquared(camera.current.position) > 0.2) {
			return
		}

		selected.set()
	}}
>
	<T.BoxGeometry args={[size, size, size]} />
	<MeshDiscardMaterial side={BackSide} />
</T.Mesh>

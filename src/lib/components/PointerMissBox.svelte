<script lang="ts">
	import { BackSide, Mesh, Vector3 } from 'three'
	import { T, useThrelte } from '@threlte/core'
	import { MeshDiscardMaterial } from '@threlte/extras'
	import { useSelected } from '$lib/hooks/useSelection.svelte'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const { camera } = useThrelte()
	const settings = useSettings()
	const selected = useSelected()
	const transformControls = useTransformControls()
	const cameraDown = new Vector3()

	const enabled = $derived(!settings.current.enableMeasure)

	const size = 1_000
</script>

<T.Mesh
	raycast={enabled ? Mesh.prototype.raycast : () => null}
	bvh={{ enabled: false }}
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

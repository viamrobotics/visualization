<script lang="ts">
	import { T, useThrelte } from '@threlte/core'
	import { MeshDiscardMaterial } from '@threlte/extras'
	import { BackSide, Mesh, Vector3 } from 'three'

	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const { camera } = useThrelte()
	const settings = useSettings()
	const selectedEntity = useSelectedEntity()
	const transformControls = useTransformControls()
	const cameraDown = new Vector3()

	const enabled = $derived(settings.current.interactionMode === 'navigate')

	const size = 1_000
</script>

<T.Mesh
	raycast={enabled ? Mesh.prototype.raycast : () => null}
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

		selectedEntity.set()
	}}
>
	<T.BoxGeometry args={[size, size, size]} />
	<MeshDiscardMaterial side={BackSide} />
</T.Mesh>

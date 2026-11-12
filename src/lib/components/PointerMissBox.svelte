<script lang="ts">
	import { T, useThrelte } from '@threlte/core/webgpu'
	import { MeshDiscardMaterial } from '@threlte/extras/webgpu'
	import { BackSide, Mesh, Vector3 } from 'three'

	import { traits, useQuery } from '$lib/ecs'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const { camera } = useThrelte()
	const settings = useSettings()
	const transformControls = useTransformControls()
	const selected = useQuery(traits.Selected)

	const cameraDown = new Vector3()

	const enabled = $derived(settings.current.interactionMode === 'navigate')

	const size = 1_000
</script>

<T.Mesh
	raycast={enabled ? Mesh.prototype.raycast : () => null}
	onpointerdown={() => {
		cameraDown.copy(camera.current.position)
	}}
	onclick={() => {
		if (transformControls.active) {
			return
		}

		if (cameraDown.distanceToSquared(camera.current.position) > 0.2) {
			return
		}

		for (const entity of selected.current) {
			entity.remove(traits.Selected)
		}
	}}
>
	<T.BoxGeometry args={[size, size, size]} />
	<MeshDiscardMaterial side={BackSide} />
</T.Mesh>

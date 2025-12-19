<!--
@component
Renders a Snapshot protobuf by spawning its transforms and drawings as entities in the scene.

```svelte
<script>
  import { Snapshot } from '@viamrobotics/motion-tools'
  import { mySnapshot } from './data'
</script>

<MotionTools>
  <Snapshot snapshot={mySnapshot} />
</MotionTools>
```
-->
<script lang="ts">
	import type { Snapshot as SnapshotProto } from '$lib/draw/v1/snapshot_pb'
	import { useWorld } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { spawnSnapshotEntities, destroyEntities, applySceneMetadata } from '$lib/snapshot'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
	import type { Entity } from 'koota'

	interface Props {
		snapshot: SnapshotProto
	}

	let { snapshot }: Props = $props()

	const world = useWorld()
	const settings = useSettings()
	const cameraControls = useCameraControls()
	let entities: Entity[] = []

	$effect(() => {
		destroyEntities(entities)
		entities = spawnSnapshotEntities(world, snapshot)

		if (snapshot.sceneMetadata) {
			settings.current = applySceneMetadata(settings.current, snapshot.sceneMetadata)
		}

		return () => destroyEntities(entities)
	})

	$effect(() => {
		if (!cameraControls.current) return

		if (snapshot.sceneMetadata?.sceneCamera?.position) {
			cameraControls.current.setPosition(
				snapshot.sceneMetadata.sceneCamera.position.x,
				snapshot.sceneMetadata.sceneCamera.position.y,
				snapshot.sceneMetadata.sceneCamera.position.z
			)
		}

		if (snapshot.sceneMetadata?.sceneCamera?.lookAt) {
			const position = snapshot.sceneMetadata.sceneCamera.position ?? { x: 0, y: 0, z: 0 }
			cameraControls.current.setLookAt(
				position.x,
				position.y,
				position.z,
				snapshot.sceneMetadata.sceneCamera.lookAt.x,
				snapshot.sceneMetadata.sceneCamera.lookAt.y,
				snapshot.sceneMetadata.sceneCamera.lookAt.z
			)
		}
	})
</script>

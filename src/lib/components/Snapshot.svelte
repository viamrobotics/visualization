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
		const { position, lookAt } = snapshot.sceneMetadata?.sceneCamera ?? {}

		cameraControls.setPose({
			position: [position?.x ?? 0, position?.y ?? 0, position?.z ?? 0],
			lookAt: [lookAt?.x ?? 0, lookAt?.y ?? 0, lookAt?.z ?? 0],
		})
	})
</script>

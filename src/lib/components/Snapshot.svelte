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
	import type { Snapshot as SnapshotProto } from '$lib/buf/draw/v1/snapshot_pb'
	import { useWorld } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { spawnSnapshotEntities, destroyEntities, applySceneMetadata } from '$lib/snapshot'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
	import type { Entity } from 'koota'
	import { untrack } from 'svelte'
	import { onDestroy } from 'svelte'

	interface Props {
		snapshot: SnapshotProto
	}

	let { snapshot }: Props = $props()

	const world = useWorld()
	const settings = useSettings()
	const cameraControls = useCameraControls()

	let entities: Entity[] = []

	$effect(() => {
		world.id.toString()
		snapshot.uuid.toString()

		untrack(() => {
			entities = spawnSnapshotEntities(world, snapshot)
		})
	})

	$effect(() => {
		if (snapshot.sceneMetadata) {
			untrack(() => {
				settings.current = applySceneMetadata(settings.current, snapshot.sceneMetadata!)
			})
		}
	})

	$effect(() => {
		const { sceneCamera } = snapshot.sceneMetadata ?? {}

		if (sceneCamera) {
			const { x = 0, y = 0, z = 0 } = sceneCamera.position ?? {}
			const { x: lx = 0, y: ly = 0, z: lz = 0 } = sceneCamera.lookAt ?? {}

			cameraControls.setPose({
				position: [x * 0.001, y * 0.001, z * 0.001],
				lookAt: [lx * 0.001, ly * 0.001, lz * 0.001],
			})
		}
	})

	onDestroy(() => {
		destroyEntities(world, entities)
	})
</script>

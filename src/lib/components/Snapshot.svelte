<!--
@component
Renders a Snapshot protobuf by spawning its transforms and drawings as entities in the scene.

```svelte
<script>
  import { Snapshot } from '@viamrobotics/visualization'
  import { mySnapshot } from './data'
</script>

<MotionTools>
  <Snapshot snapshot={mySnapshot} />
</MotionTools>
```
-->
<script lang="ts">
	import { untrack } from 'svelte'
	import { onDestroy } from 'svelte'

	import type { Snapshot as SnapshotProto } from '$lib/buf/draw/v1/snapshot_pb'

	import { uuidBytesToString } from '$lib/draw'
	import { traits, useWorld } from '$lib/ecs'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
	import { useRelationships } from '$lib/hooks/useRelationships.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { applySceneMetadata, reconcileSnapshotEntities, type SnapshotEntity } from '$lib/snapshot'

	interface Props {
		snapshot: SnapshotProto
	}

	let { snapshot }: Props = $props()

	const world = useWorld()
	const settings = useSettings()
	const cameraControls = useCameraControls()
	const relationships = useRelationships()

	let entitiesByUuid = new Map<string, SnapshotEntity>()
	let unkeyedEntities: SnapshotEntity[] = []
	let lastSnapshotUuid: string | undefined = undefined

	$effect(() => {
		void snapshot

		untrack(() => {
			for (const entry of unkeyedEntities) {
				if (world.has(entry.entity)) entry.entity.destroy()
			}
			unkeyedEntities = []

			const nextSnapshotUuid = uuidBytesToString(snapshot.uuid)
			if (lastSnapshotUuid !== undefined && nextSnapshotUuid !== lastSnapshotUuid) {
				for (const entry of entitiesByUuid.values()) {
					if (world.has(entry.entity)) entry.entity.destroy()
				}
				entitiesByUuid = new Map()
			}

			const result = reconcileSnapshotEntities(world, snapshot, entitiesByUuid)
			entitiesByUuid = result.current
			unkeyedEntities = result.unkeyed
			lastSnapshotUuid = nextSnapshotUuid

			for (const entry of [...result.spawned, ...result.updated]) {
				relationships.apply(entry.entity, entry.relationships)
				const uuid = entry.entity.get(traits.UUID)
				if (uuid) relationships.flush(uuid)
			}
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

			if (sceneCamera.cameraType.case === 'orthographicCamera') {
				const orthographicCamera = sceneCamera.cameraType.value as { zoom?: number }
				const zoom = orthographicCamera.zoom
				if (zoom !== undefined) {
					cameraControls.setZoom(zoom)
				}
			}
		}
	})

	onDestroy(() => {
		for (const entry of entitiesByUuid.values()) {
			if (world.has(entry.entity)) entry.entity.destroy()
		}
		for (const entry of unkeyedEntities) {
			if (world.has(entry.entity)) entry.entity.destroy()
		}
	})
</script>

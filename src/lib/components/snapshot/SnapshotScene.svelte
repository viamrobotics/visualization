<script lang="ts">
	import { Vector3 } from 'three'
	import { T } from '@threlte/core'
	import { Grid, PerfMonitor } from '@threlte/extras'
	import Camera from '$lib/components/Camera.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import CameraControls from '$lib/components/CameraControls.svelte'
	import { type PassSnapshot } from '$lib/snapshot'
	import { fromTransform, WorldObject, type ArrowsGeometry } from '$lib/WorldObject.svelte'
	import SnapshotWorld from './SnapshotWorld.svelte'
	import { transformWithUUID } from '@viamrobotics/sdk'
	import type { CameraPose } from '$lib/hooks/useControls.svelte'

	interface Props {
		snapshot: PassSnapshot
		cameraPose: CameraPose
	}

	let { snapshot, cameraPose }: Props = $props()

	const settings = useSettings()

	let geometries = $state.raw<WorldObject[]>([])
	let arrows = $state.raw<WorldObject<ArrowsGeometry>[]>([])

	$effect(() => {
		const nextGeometries: WorldObject[] = []
		const nextArrows: WorldObject<ArrowsGeometry>[] = []

		for (let i = 0; i < snapshot.transforms.length; i++) {
			const transform = transformWithUUID(snapshot.transforms[i])
			const worldObject = fromTransform(transform)

			if (worldObject.geometry?.geometryType.case === 'arrows') {
				nextArrows.push(worldObject as WorldObject<ArrowsGeometry>)
			} else {
				nextGeometries.push(worldObject)
			}
		}

		geometries = nextGeometries
		arrows = nextArrows
	})
</script>

{#if settings.current.renderStats}
	<PerfMonitor anchorX="right" />
{/if}

<T.Group>
	<Camera position={cameraPose.position}>
		<CameraControls />
	</Camera>

	{#if settings.current.grid}
		<Grid
			raycast={() => null}
			bvh={{ enabled: false }}
			plane="xy"
			sectionColor="#333"
			infiniteGrid
			cellSize={settings.current.gridCellSize}
			sectionSize={settings.current.gridSectionSize}
			fadeOrigin={new Vector3()}
			fadeDistance={settings.current.gridFadeDistance}
		/>
	{/if}

	<SnapshotWorld
		{geometries}
		{arrows}
	/>

	<T.DirectionalLight position={[3, 3, 3]} />
	<T.DirectionalLight position={[-3, -3, -3]} />
	<T.AmbientLight />
</T.Group>

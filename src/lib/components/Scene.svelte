<script lang="ts">
	import { Vector3 } from 'three'
	import { T } from '@threlte/core'
	import { Grid, interactivity, PerfMonitor, bvh } from '@threlte/extras'
	import { PortalTarget } from './portal'
	import WorldObjects from '$lib/components/WorldObjects.svelte'
	import Selected from '$lib/components/Selected.svelte'
	import Focus from '$lib/components/Focus.svelte'
	import StaticGeometries from '$lib/components/StaticGeometries.svelte'
	import Camera from '$lib/components/Camera.svelte'
	import { useFocusedObject3d } from '$lib/hooks/useSelection.svelte'
	import type { Snippet } from 'svelte'
	import { useXR } from '@threlte/xr'

	import { useOrigin } from './xr/useOrigin.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import CameraControls from './CameraControls.svelte'
	import MeasureTool from './MeasureTool.svelte'
	import PointerMissBox from './PointerMissBox.svelte'

	interface Props {
		children?: Snippet
	}

	let { children }: Props = $props()

	const settings = useSettings()
	const focusedObject3d = useFocusedObject3d()
	const origin = useOrigin()

	const { raycaster, enabled } = interactivity({
		filter: (items) => {
			const item = items.find((item) => {
				return item.object.visible === undefined || item.object.visible === true
			})

			return item ? [item] : []
		},
	})
	$effect(() => {
		enabled.set(!settings.current.enableMeasure)
	})
	raycaster.firstHitOnly = true

	bvh(() => ({ helper: false }))

	const focusedObject = $derived(focusedObject3d.current)

	const { isPresenting } = useXR()
</script>

{#if settings.current.renderStats}
	<PerfMonitor anchorX="right" />
{/if}

<T.Group
	position={origin.position}
	rotation.x={$isPresenting ? -Math.PI / 2 : 0}
	rotation.z={origin.rotation}
>
	<PointerMissBox />
	<MeasureTool />

	{#if focusedObject}
		<Focus object3d={focusedObject} />
	{:else}
		{#if !$isPresenting}
			<Camera position={[3, 3, 3]}>
				<CameraControls />
			</Camera>
		{/if}

		<StaticGeometries />
		<Selected />

		{#if !$isPresenting && settings.current.grid}
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
	{/if}

	<T.Group attach={focusedObject ? false : undefined}>
		<!-- Capture both "default" and "world" portals -->
		<PortalTarget />
		<PortalTarget id="world" />

		<WorldObjects />
	</T.Group>

	{@render children?.()}

	<T.DirectionalLight position={[3, 3, 3]} />
	<T.DirectionalLight position={[-3, -3, -3]} />
	<T.AmbientLight />
</T.Group>

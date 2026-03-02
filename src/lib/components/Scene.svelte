<script lang="ts">
	import { Vector3 } from 'three'
	import { T } from '@threlte/core'
	import { Grid, interactivity, PerfMonitor, PortalTarget } from '@threlte/extras'
	import Entities from '$lib/components/Entities.svelte'
	import Selected from '$lib/components/Selected.svelte'
	import Focus from '$lib/components/Focus.svelte'
	import StaticGeometries from '$lib/components/StaticGeometries.svelte'
	import Camera from '$lib/components/Camera.svelte'
	import { useFocusedObject3d } from '$lib/hooks/useSelection.svelte'
	import type { Snippet } from 'svelte'
	import { useXR } from '@threlte/xr'
	import { bvh } from '$lib/plugins/bvh.svelte'
	import { useOrigin } from './xr/useOrigin.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import CameraControls from './CameraControls.svelte'
	import MeasureTool from './MeasureTool/MeasureTool.svelte'
	import PointerMissBox from './PointerMissBox.svelte'
	import BatchedArrows from './BatchedArrows.svelte'
	import Arrows from './Arrows/ArrowGroups.svelte'

	interface Props {
		children?: Snippet
	}

	let { children }: Props = $props()

	const settings = useSettings()
	const focusedObject3d = useFocusedObject3d()
	const origin = useOrigin()

	const { raycaster, enabled } = interactivity({
		filter: (intersections) => {
			const match = intersections.find((intersection) => {
				return intersection.object.visible === undefined || intersection.object.visible === true
			})

			return match ? [match] : []
		},
	})

	$effect(() => {
		enabled.set(settings.current.interactionMode === 'navigate')
	})

	bvh(raycaster, () => ({ helper: false }))

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
		<PortalTarget id="world" />
		<PortalTarget />

		<Entities />
		<BatchedArrows />
		<Arrows />
	</T.Group>

	{@render children?.()}

	<T.DirectionalLight position={[3, 3, 3]} />
	<T.AmbientLight />
</T.Group>

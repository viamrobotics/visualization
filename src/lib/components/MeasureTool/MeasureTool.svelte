<script lang="ts">
	import { untrack } from 'svelte'
	import { Vector3, type Intersection } from 'three'
	import { T } from '@threlte/core'
	import { HTML, MeshLineGeometry, MeshLineMaterial, Portal } from '@threlte/extras'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import Button from '../dashboard/Button.svelte'
	import MeasurePoint from './MeasurePoint.svelte'
	import { useMouseRaycaster } from '$lib/hooks/useMouseRaycaster.svelte'
	import { useFocusedEntity } from '$lib/hooks/useSelection.svelte'
	import ToggleGroup from '../Overlay/ToggleGroup.svelte'
	import Popover from '../Overlay/Popover.svelte'

	const focusedEntity = useFocusedEntity()
	const settings = useSettings()

	const htmlPosition = new Vector3()

	let step: 'idle' | 'p1' | 'p2' = 'idle'

	let intersection = $state<Intersection>()
	let p1 = $state.raw<Vector3>()
	let p2 = $state.raw<Vector3>()

	const enabled = $derived(settings.current.enableMeasure)

	const { onclick, onmove, raycaster } = useMouseRaycaster(() => ({
		enabled,
	}))
	raycaster.firstHitOnly = true
	raycaster.params.Points.threshold = 0.005

	onmove((event) => {
		intersection = event.intersections[0]

		// Only handle axis restrictions if a first point has been placed
		if (!p1) {
			return
		}

		if (settings.current.enableMeasureAxisX === false) {
			intersection.point.x = p1.x
		}

		if (settings.current.enableMeasureAxisY === false) {
			intersection.point.y = p1.y
		}

		if (settings.current.enableMeasureAxisZ === false) {
			intersection.point.z = p1.z
		}
	})

	onclick(() => {
		if (step === 'idle' && intersection) {
			p1 = intersection.point.clone()
			step = 'p1'
		} else if (step === 'p1' && intersection) {
			p2 = intersection.point.clone()
			step = 'p2'
		} else if (step === 'p2') {
			p1 = undefined
			p2 = undefined
			step = 'idle'
		}
	})

	const clear = () => {
		p1 = undefined
		p2 = undefined
		step = 'idle'
	}

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		;(focusedEntity.current, enabled)
		untrack(() => clear())
	})
</script>

<Portal id="dashboard">
	<fieldset class="relative">
		<div class="flex">
			<Button
				active={enabled}
				icon="ruler"
				description="{enabled ? 'Disable' : 'Enable'} measurement"
				onclick={() => {
					settings.current.enableMeasure = !settings.current.enableMeasure
				}}
			/>
			<Popover>
				{#snippet trigger(triggerProps)}
					<Button
						{...triggerProps}
						active={enabled}
						class="border-l-0"
						icon="filter-sliders"
						description="Measurement settings"
					/>
				{/snippet}

				<div class="border-medium m-2 border bg-white p-2 text-xs">
					<div class="flex items-center gap-2">
						Enabled axes
						<ToggleGroup
							multiple
							buttons={[
								{ value: 'x', on: settings.current.enableMeasureAxisX },
								{ value: 'y', on: settings.current.enableMeasureAxisY },
								{ value: 'z', on: settings.current.enableMeasureAxisZ },
							]}
							onclick={(details) => {
								settings.current.enableMeasureAxisX = details.includes('x')
								settings.current.enableMeasureAxisY = details.includes('y')
								settings.current.enableMeasureAxisZ = details.includes('z')
							}}
						/>
					</div>
				</div>
			</Popover>
		</div>
	</fieldset>
</Portal>

{#if enabled}
	{#if intersection && step !== 'p2'}
		<MeasurePoint
			position={intersection?.point.toArray()}
			opacity={0.5}
		/>
	{/if}

	{#if p1}
		<MeasurePoint
			position={p1.toArray()}
			opacity={0.5}
		/>
	{/if}

	{#if p2}
		<MeasurePoint
			position={p2.toArray()}
			opacity={0.5}
		/>
	{/if}

	{#if p1 && (p2 || intersection)}
		<T.Mesh
			raycast={() => null}
			bvh={{ enabled: false }}
			renderOrder={1}
		>
			<MeshLineGeometry points={[p1, p2 ?? intersection?.point ?? new Vector3()]} />
			<MeshLineMaterial
				width={2.5}
				depthTest={false}
				color="black"
				opacity={p2 ? 0.5 : 0.2}
				attenuate={false}
				transparent
			/>
		</T.Mesh>

		{#if p2}
			<HTML
				center
				position={htmlPosition.lerpVectors(p1, p2, 0.5).toArray()}
			>
				<div class="border border-black bg-white px-1 py-0.5 text-xs">
					{p1.distanceTo(p2).toFixed(2)}<span class="text-subtle-2">m</span>
				</div>
			</HTML>
		{/if}
	{/if}
{/if}

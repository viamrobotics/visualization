<script lang="ts">
	import { T } from '@threlte/core'
	import { HTML, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { untrack } from 'svelte'
	import { Element } from 'svelte-tweakpane-ui'
	import { type Intersection, Vector3 } from 'three'

	import MeasurePoint from '$lib/components/MeasurePoint.svelte'
	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import DropdownPane from '$lib/components/overlay/dashboard/DropdownPane.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import ToggleGroup from '$lib/components/overlay/ToggleGroup.svelte'
	import { useMouseRaycaster } from '$lib/hooks/useMouseRaycaster.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()

	const htmlPosition = new Vector3()

	let step = $state<'idle' | 'p1' | 'p2'>('idle')
	let intersection = $state<Intersection>()
	let p1 = $state.raw<Vector3>()
	let p2 = $state.raw<Vector3>()

	const enabled = $derived(settings.current.interactionMode === 'measure')

	const { onclick, onmove, raycaster } = useMouseRaycaster(() => ({
		enabled,
	}))
	raycaster.firstHitOnly = true
	raycaster.params.Points.threshold = 0.005

	onmove((event) => {
		intersection = event.intersections[0]

		if (!p1 || !intersection) {
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
		if (!enabled) {
			untrack(() => clear())
		}
	})
</script>

<DashboardPortal>
	<fieldset class="relative">
		<div class="flex">
			<Button
				active={enabled}
				class="rounded-r-none"
				icon="ruler"
				description="Measurement"
				onclick={() => {
					settings.current.interactionMode = enabled ? 'navigate' : 'measure'
				}}
			/>
			<DropdownPane
				title="Measurement"
				active={enabled}
				description="Measurement settings"
			>
				<Element>
					<div class="font-public-sans text-subtle-1 flex items-center gap-2 text-xs">
						<span>Axes</span>
						<ToggleGroup
							multiple
							options={[
								{ label: 'x', selected: settings.current.enableMeasureAxisX },
								{ label: 'y', selected: settings.current.enableMeasureAxisY },
								{ label: 'z', selected: settings.current.enableMeasureAxisZ },
							]}
							onSelect={(details) => {
								settings.current.enableMeasureAxisX = details.includes('x')
								settings.current.enableMeasureAxisY = details.includes('y')
								settings.current.enableMeasureAxisZ = details.includes('z')
							}}
						/>
					</div>
				</Element>
			</DropdownPane>
		</div>
	</fieldset>
</DashboardPortal>

{#if enabled}
	{#if intersection && step !== 'p2'}
		<MeasurePoint
			position={intersection.point.toArray()}
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
				zIndexRange={[3, 0]}
			>
				<div class="border border-black bg-white px-1 py-0.5 text-xs">
					{p1.distanceTo(p2).toFixed(3)}<span class="text-subtle-2">m</span>
				</div>
			</HTML>
		{/if}
	{/if}
{/if}

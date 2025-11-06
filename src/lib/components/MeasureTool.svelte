<script lang="ts">
	import { untrack } from 'svelte'
	import { Vector3, type Intersection } from 'three'
	import { T } from '@threlte/core'
	import { HTML, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import Button from './dashboard/Button.svelte'
	import Portal from './portal/Portal.svelte'
	import DotSprite from './DotSprite.svelte'
	import { useMouseRaycaster } from '$lib/hooks/useMouseRaycaster.svelte'
	import { useFocused } from '$lib/hooks/useSelection.svelte'

	const focus = useFocused()
	const settings = useSettings()

	const htmlPosition = new Vector3()

	let step: 'idle' | 'p1' | 'p2' = 'idle'

	let intersection = $state.raw<Intersection>()
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
		;(focus.current, enabled)
		untrack(() => clear())
	})
</script>

<Portal id="dashboard">
	<fieldset>
		<Button
			active
			icon="ruler"
			class={enabled ? '' : 'text-gray-4!'}
			description="{enabled ? 'Disable' : 'Enable'} measurement"
			onclick={() => {
				settings.current.enableMeasure = !settings.current.enableMeasure
			}}
		/>
	</fieldset>
</Portal>

{#if enabled}
	{#if intersection}
		<DotSprite
			position={intersection?.point.toArray()}
			opacity={0.5}
		/>
	{/if}

	{#if p1}
		<DotSprite
			position={p1.toArray()}
			opacity={0.5}
		/>
	{/if}

	{#if p2}
		<DotSprite
			position={p2.toArray()}
			opacity={0.5}
		/>
	{/if}

	{#if p1 && p2}
		<T.Mesh
			raycast={() => null}
			bvh={{ enabled: false }}
			renderOrder={1}
		>
			<MeshLineGeometry points={[p1, p2]} />
			<MeshLineMaterial
				width={2.5}
				depthTest={false}
				color="black"
				opacity={0.5}
				attenuate={false}
				transparent
			/>
		</T.Mesh>
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

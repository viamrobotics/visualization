<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core'
	import { View } from '@threlte/extras'
	import { Slider, type SliderChangeEvent } from 'svelte-tweakpane-ui'
	import { Matrix4, OrthographicCamera, PerspectiveCamera } from 'three'

	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import FloatingPanel from '$lib/components/overlay/FloatingPanel.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	interface Props {
		frameName: string
	}

	const { frameName }: Props = $props()

	const { scene, renderStage } = useThrelte()
	const settings = useSettings()
	const partID = usePartID()

	// Three.js cameras look down -Z. Viam camera frames put the optical axis along
	// +Z with image-down along +Y, so a 180° rotation around X aligns the render
	// with what a sensor at this frame would see.
	const VIAM_TO_THREE_CAMERA = new Matrix4().makeRotationX(Math.PI)

	const PERSPECTIVE_FOV_DEG = 60
	// Ortho frustum vertical extent at zoom=1, sized to match what the perspective
	// camera sees at 1 m. zoom > 1 narrows the frustum, zoom < 1 widens it.
	const BASE_ORTHO_HEIGHT = 2 * Math.tan((PERSPECTIVE_FOV_DEG * Math.PI) / 360)

	const namedEntities = useQuery(traits.Name)
	const entity = $derived(namedEntities.current.find((e) => e.get(traits.Name) === frameName))

	const perspectiveCamera = new PerspectiveCamera(PERSPECTIVE_FOV_DEG, 1, 0.01, 1000)
	perspectiveCamera.up.set(0, 0, 1)

	const orthographicCamera = new OrthographicCamera(-1, 1, 1, -1, -1000, 1000)
	orthographicCamera.up.set(0, 0, 1)

	let isOpen = $state(true)
	let cameraMode = $state<'perspective' | 'orthographic'>('perspective')
	let orthoZoom = $state(1)
	let viewEl = $state.raw<HTMLDivElement>()

	const orthoHeight = $derived(BASE_ORTHO_HEIGHT / orthoZoom)

	const composed = new Matrix4()

	$effect(() => {
		if (entity === undefined) {
			isOpen = false
		}
	})

	$effect(() => {
		if (isOpen) return
		const list = settings.current.openFramePovWidgets[partID.current] ?? []
		const next = list.filter((n) => n !== frameName)
		if (next.length === list.length) return
		settings.current.openFramePovWidgets = {
			...settings.current.openFramePovWidgets,
			[partID.current]: next,
		}
	})

	useTask(
		() => {
			if (!viewEl || !entity) return
			const worldMat = entity.get(traits.WorldMatrix)
			if (!worldMat) return

			const width = viewEl.clientWidth
			const height = viewEl.clientHeight
			if (width <= 0 || height <= 0) return

			const povCamera = cameraMode === 'perspective' ? perspectiveCamera : orthographicCamera

			composed.multiplyMatrices(worldMat, VIAM_TO_THREE_CAMERA)
			composed.decompose(povCamera.position, povCamera.quaternion, povCamera.scale)

			if (povCamera === orthographicCamera) {
				const aspect = width / height
				const halfH = orthoHeight / 2
				const halfW = halfH * aspect
				orthographicCamera.left = -halfW
				orthographicCamera.right = halfW
				orthographicCamera.top = halfH
				orthographicCamera.bottom = -halfH
			}

			povCamera.updateProjectionMatrix()
			povCamera.updateMatrixWorld(true)
		},
		{ stage: renderStage, autoInvalidate: false }
	)

	const handleZoomChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		orthoZoom = event.detail.value as number
	}
</script>

<FloatingPanel
	title={`POV: ${frameName}`}
	bind:isOpen
	defaultSize={{ width: 320, height: 240 }}
	resizable
	bodyClass="bg-transparent"
>
	<div
		bind:this={viewEl}
		class="absolute inset-0 block h-full w-full"
	></div>

	<div class="absolute top-1 right-1 z-1">
		<Button
			icon={cameraMode === 'orthographic' ? 'grid-orthographic' : 'grid-perspective'}
			description={cameraMode === 'orthographic'
				? 'Switch to perspective view'
				: 'Switch to orthographic view'}
			tooltipLocation="left"
			onclick={() => (cameraMode = cameraMode === 'orthographic' ? 'perspective' : 'orthographic')}
		/>
	</div>

	{#if cameraMode === 'orthographic'}
		<div class="absolute right-1 bottom-1 left-1 z-1 rounded bg-white/85 p-1">
			<Slider
				label="zoom"
				value={orthoZoom}
				min={0.25}
				max={5}
				step={0.05}
				format={(v) => `${v.toFixed(2)}×`}
				on:change={handleZoomChange}
			/>
		</div>
	{/if}
</FloatingPanel>

<View
	dom={viewEl}
	{scene}
>
	{#if cameraMode === 'perspective'}
		<T
			is={perspectiveCamera}
			makeDefault
		/>
	{:else}
		<T
			is={orthographicCamera}
			manual
			makeDefault
		/>
	{/if}
</View>

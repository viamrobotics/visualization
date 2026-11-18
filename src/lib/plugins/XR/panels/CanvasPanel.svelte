<script lang="ts">
	import type { Vector2 } from 'three'

	import { T, useThrelte } from '@threlte/core/webgpu'

	import type { PanelNode } from './panelNode'

	import { createPanelSurface } from './createPanelSurface'
	import { drawPanel } from './drawPanel'
	import { findPanelButton } from './findPanelButton'
	import { layoutPanel } from './layoutPanel'
	import { panelFont } from './panelTheme'

	interface Props {
		/** The panel's content, usually built with `panelColumn` or `panelRow`. */
		root: PanelNode
		/**
		 * World units per layout pixel. With `WristDisplay`'s default scale of
		 * 0.03, the default makes one layout pixel 0.3 mm on the wrist.
		 */
		pixelSize?: number
		/** Canvas pixels per layout pixel. Raise it if text looks soft up close. */
		resolution?: number
		/** Draw over everything else in the scene instead of being occluded by it. */
		overlay?: boolean
	}

	const { root, pixelSize = 0.01, resolution = 2, overlay = true }: Props = $props()

	const OVERLAY_RENDER_ORDER = 999
	const NO_BUTTON = -1

	const { invalidate } = useThrelte()

	const measureContext = createPanelSurface(1, 1).context
	const measureText = (text: string, fontSize: number) => {
		measureContext.font = panelFont(fontSize)
		return measureContext.measureText(text).width
	}

	// Text measured before a web font loads is measured in the fallback font.
	let fontLoads = $state(0)

	$effect(() => {
		const onFontsLoaded = () => {
			fontLoads += 1
		}
		document.fonts.addEventListener('loadingdone', onFontsLoaded)
		return () => document.fonts.removeEventListener('loadingdone', onFontsLoaded)
	})

	const layout = $derived.by(() => {
		void fontLoads
		return layoutPanel(root, measureText)
	})

	const canvasWidth = $derived(Math.ceil(layout.width * resolution))
	const canvasHeight = $derived(Math.ceil(layout.height * resolution))
	const surface = $derived(createPanelSurface(canvasWidth, canvasHeight))

	$effect(() => {
		const { texture } = surface
		return () => texture.dispose()
	})

	let hoveredIndex = $state(NO_BUTTON)
	let pressedIndex = $state(NO_BUTTON)

	$effect(() => {
		const { context, texture } = surface
		context.setTransform(resolution, 0, 0, resolution, 0, 0)
		drawPanel(context, layout, { hoveredIndex, pressedIndex })
		texture.needsUpdate = true
		invalidate()
	})

	interface PanelPointerEvent {
		uv?: Vector2
	}

	const buttonAt = (event: PanelPointerEvent) =>
		event.uv ? findPanelButton(layout, event.uv) : NO_BUTTON

	const onclick = (event: PanelPointerEvent) => {
		const node = layout.boxes[buttonAt(event)]?.node
		if (node?.type === 'button') node.onclick()
	}

	const onpointerleave = () => {
		hoveredIndex = NO_BUTTON
		pressedIndex = NO_BUTTON
	}
</script>

<T.Mesh
	renderOrder={overlay ? OVERLAY_RENDER_ORDER : 0}
	onpointermove={(event: PanelPointerEvent) => (hoveredIndex = buttonAt(event))}
	onpointerdown={(event: PanelPointerEvent) => (pressedIndex = buttonAt(event))}
	onpointerup={() => (pressedIndex = NO_BUTTON)}
	{onpointerleave}
	{onclick}
>
	<T.PlaneGeometry args={[layout.width * pixelSize, layout.height * pixelSize]} />
	<T.MeshBasicMaterial
		map={surface.texture}
		transparent
		depthTest={!overlay}
		depthWrite={!overlay}
	/>
</T.Mesh>

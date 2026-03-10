<script lang="ts">
	import { untrack } from 'svelte'
	import { T } from '@threlte/core'
	import { CanvasTexture, PlaneGeometry } from 'three'
	import { xrToast, type XRToastItem, type ToastVariant } from '$lib/components/xr/toasts.svelte'
	import { Headset } from '@threlte/xr'

	const CANVAS_WIDTH = 700
	const TOAST_HEIGHT = 80
	const TOAST_GAP = 10
	const MAX_VISIBLE = 5
	const PLANE_WIDTH = 0.7

	// Offscreen canvas (created once)
	const canvas = document.createElement('canvas')
	canvas.width = CANVAS_WIDTH
	canvas.height = 1
	const texture = new CanvasTexture(canvas)

	let geometry: PlaneGeometry | undefined = $state()

	const visibleToasts = $derived(xrToast.toasts.slice(-MAX_VISIBLE))
	const hasToasts = $derived(visibleToasts.length > 0)

	// Variant styling matching Prime design tokens
	const VARIANT_STYLES: Record<ToastVariant, { accent: string; bg: string }> = {
		success: { accent: '#22C55E', bg: 'rgba(13, 40, 24, 0.94)' },
		danger: { accent: '#EF4444', bg: 'rgba(45, 15, 15, 0.94)' },
		warning: { accent: '#F59E0B', bg: 'rgba(45, 34, 16, 0.94)' },
		info: { accent: '#3B82F6', bg: 'rgba(15, 26, 45, 0.94)' },
	}

	function drawRoundRect(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		r: number
	) {
		ctx.beginPath()
		ctx.moveTo(x + r, y)
		ctx.lineTo(x + w - r, y)
		ctx.quadraticCurveTo(x + w, y, x + w, y + r)
		ctx.lineTo(x + w, y + h - r)
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
		ctx.lineTo(x + r, y + h)
		ctx.quadraticCurveTo(x, y + h, x, y + h - r)
		ctx.lineTo(x, y + r)
		ctx.quadraticCurveTo(x, y, x + r, y)
		ctx.closePath()
	}

	function drawIcon(
		ctx: CanvasRenderingContext2D,
		variant: ToastVariant,
		cx: number,
		cy: number,
		size: number
	) {
		const color = VARIANT_STYLES[variant].accent
		ctx.strokeStyle = color
		ctx.fillStyle = color
		ctx.lineWidth = 3.5
		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'

		if (variant === 'success') {
			// Checkmark
			ctx.beginPath()
			ctx.moveTo(cx - size * 0.35, cy + size * 0.05)
			ctx.lineTo(cx - size * 0.08, cy + size * 0.3)
			ctx.lineTo(cx + size * 0.4, cy - size * 0.25)
			ctx.stroke()
		} else if (variant === 'danger') {
			// X mark
			const s = size * 0.28
			ctx.beginPath()
			ctx.moveTo(cx - s, cy - s)
			ctx.lineTo(cx + s, cy + s)
			ctx.moveTo(cx + s, cy - s)
			ctx.lineTo(cx - s, cy + s)
			ctx.stroke()
		} else if (variant === 'warning') {
			// Triangle outline with !
			ctx.lineWidth = 3
			ctx.beginPath()
			ctx.moveTo(cx, cy - size * 0.32)
			ctx.lineTo(cx + size * 0.34, cy + size * 0.26)
			ctx.lineTo(cx - size * 0.34, cy + size * 0.26)
			ctx.closePath()
			ctx.stroke()
			// Exclamation mark
			ctx.lineWidth = 3
			ctx.beginPath()
			ctx.moveTo(cx, cy - size * 0.12)
			ctx.lineTo(cx, cy + size * 0.06)
			ctx.stroke()
			ctx.beginPath()
			ctx.arc(cx, cy + size * 0.16, 2, 0, Math.PI * 2)
			ctx.fill()
		} else {
			// Info: circle with i
			ctx.lineWidth = 3
			ctx.beginPath()
			ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2)
			ctx.stroke()
			// i dot
			ctx.beginPath()
			ctx.arc(cx, cy - size * 0.15, 2.5, 0, Math.PI * 2)
			ctx.fill()
			// i stem
			ctx.lineWidth = 3
			ctx.beginPath()
			ctx.moveTo(cx, cy - size * 0.04)
			ctx.lineTo(cx, cy + size * 0.2)
			ctx.stroke()
		}
	}

	function renderToasts(toasts: XRToastItem[]) {
		const ctx = canvas.getContext('2d')!
		ctx.clearRect(0, 0, canvas.width, canvas.height)

		if (toasts.length === 0) {
			texture.needsUpdate = true
			return
		}

		const radius = 12
		const accentBarWidth = 8
		const iconCenterX = accentBarWidth + 30
		const textStartX = accentBarWidth + 56

		let index = 0
		for (const toast of toasts) {
			const y = index * (TOAST_HEIGHT + TOAST_GAP)
			const style = VARIANT_STYLES[toast.variant]

			// Draw background with clip (so accent bar respects rounded corners)
			ctx.save()
			drawRoundRect(ctx, 0, y, CANVAS_WIDTH, TOAST_HEIGHT, radius)
			ctx.clip()

			// Fill background
			ctx.fillStyle = style.bg
			ctx.fillRect(0, y, CANVAS_WIDTH, TOAST_HEIGHT)

			// Accent bar on left
			ctx.fillStyle = style.accent
			ctx.fillRect(0, y, accentBarWidth, TOAST_HEIGHT)

			ctx.restore()

			// Subtle border
			ctx.strokeStyle = style.accent + '50' // 31% opacity
			ctx.lineWidth = 2
			drawRoundRect(ctx, 1, y + 1, CANVAS_WIDTH - 2, TOAST_HEIGHT - 2, radius)
			ctx.stroke()

			// Icon
			drawIcon(ctx, toast.variant, iconCenterX, y + TOAST_HEIGHT / 2, 28)

			// Message text
			ctx.fillStyle = '#ffffff'
			ctx.font = '28px sans-serif'
			ctx.textBaseline = 'middle'
			ctx.fillText(toast.message, textStartX, y + TOAST_HEIGHT / 2)

			index += 1
		}

		texture.needsUpdate = true
	}

	// Combined effect: resize canvas, update geometry, render
	$effect(() => {
		const toasts = visibleToasts

		if (toasts.length === 0) {
			renderToasts([])
			return
		}

		const h = toasts.length * (TOAST_HEIGHT + TOAST_GAP) - TOAST_GAP
		canvas.height = h

		untrack(() => geometry?.dispose())
		const aspect = CANVAS_WIDTH / h
		geometry = new PlaneGeometry(PLANE_WIDTH, PLANE_WIDTH / aspect)

		renderToasts(toasts)
	})

	const dispose = () => {
		texture.dispose()
		untrack(() => geometry?.dispose())
	}

	// Cleanup
	$effect(() => {
		return dispose
	})
</script>

<Headset>
	{#if hasToasts && geometry}
		<T.Mesh
			position={[0, -0.3, -1.5]}
			renderOrder={999}
		>
			<T is={geometry} />
			<T.MeshBasicMaterial
				map={texture}
				transparent
				depthTest={false}
			/>
		</T.Mesh>
	{/if}
</Headset>

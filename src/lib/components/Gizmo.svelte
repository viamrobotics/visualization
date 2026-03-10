<script lang="ts">
	import { Gizmo } from '@threlte/extras'
	import { useThrelte } from '@threlte/core'
	import type { ComponentProps } from 'svelte'

	const props: Omit<ComponentProps<typeof Gizmo>, 'ref'> = $props()

	const { invalidate, dpr, renderer } = useThrelte()

	let ref = $state.raw<ComponentProps<typeof Gizmo>['ref']>()

	// Recompute the gizmo viewport whenever the canvas resizes.
	// Threlte's size store is derived from the outer div, which can settle
	// at a different time than the canvas — observing the canvas directly
	// ensures domUpdate() reads correct getBoundingClientRect() values.
	$effect(() => {
		const canvas = renderer.domElement

		const observer = new ResizeObserver(() => {
			ref?.domUpdate()
			invalidate()
		})

		observer.observe(canvas)

		return () => observer.disconnect()
	})

	// Keep threlte's dpr in sync with the actual devicePixelRatio.
	// Threlte only reads it once at mount, so browser zoom leaves it stale.
	$effect(() => {
		let dprMedia: MediaQueryList

		const onDprChange = () => {
			dpr.set(window.devicePixelRatio)
			invalidate()

			dprMedia.removeEventListener('change', onDprChange)
			dprMedia = window.matchMedia(
				`(resolution: ${window.devicePixelRatio}dppx)`
			)
			dprMedia.addEventListener('change', onDprChange)
		}

		dprMedia = window.matchMedia(
			`(resolution: ${window.devicePixelRatio}dppx)`
		)
		dprMedia.addEventListener('change', onDprChange)

		return () => {
			dprMedia.removeEventListener('change', onDprChange)
		}
	})
</script>

<Gizmo
	bind:ref
	{...props}
/>

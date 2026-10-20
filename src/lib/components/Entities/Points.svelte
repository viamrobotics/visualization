<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { T, useTask, useThrelte } from '@threlte/core'
	import { OrthographicCamera, Points, PointsMaterial } from 'three'

	import { asColor, isSingleColor } from '$lib/buffer'
	import { traits, useOpacity, useTrait } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { clampPointSize } from '$lib/three/clampPointSize'

	import { useEntityEvents } from './hooks/useEntityEvents.svelte'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const { camera, invalidate, renderer } = useThrelte()
	const settings = useSettings()

	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const geometry = useTrait(() => entity, traits.BufferGeometry)
	const entityColor = useTrait(() => entity, traits.Color)
	const colors = useTrait(() => entity, traits.Colors)
	const entityPointSize = useTrait(() => entity, traits.PointSize)
	const opacity = useOpacity(() => entity)
	const invisible = useTrait(() => entity, traits.InheritedInvisible)
	const renderOrder = useTrait(() => entity, traits.RenderOrder)
	const materialProps = useTrait(() => entity, traits.Material)

	const pointSize = $derived(
		entityPointSize.current ? entityPointSize.current * 0.001 : settings.current.pointSize
	)
	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	const points = new Points()
	points.matrixAutoUpdate = false
	const material = points.material as PointsMaterial
	material.toneMapped = false

	const maxPointSize = { value: 0 }
	clampPointSize(material, maxPointSize)

	// Orthographic size is driven per frame by the task below, which reads a zoom that isn't
	// reactive. Writing it here too would clobber that between frames.
	$effect(() => {
		if (!orthographic) {
			material.size = pointSize
			invalidate()
		}
	})

	$effect(() => {
		// gl_PointSize is in framebuffer pixels; the setting is in CSS pixels.
		maxPointSize.value = settings.current.maxPointSize * renderer.getPixelRatio()
		invalidate()
	})

	$effect(() => {
		if (geometry.current?.getAttribute('color')) {
			material.color.set(0xffffff)
		} else if (entityColor.current) {
			const { r, g, b } = entityColor.current
			material.color.setRGB(r, g, b)
		} else if (colors.current && isSingleColor(colors.current)) {
			asColor(colors.current, material.color, 0)
		} else {
			material.color.set(settings.current.pointColor)
		}

		invalidate()
	})

	/**
	 * Whether the cloud is drawn at less than full alpha, from either source.
	 * Both are considered here so the two cannot conflict.
	 */
	const isFaded = $derived.by(() => {
		if (opacity.current < 1) return true

		const vertexColors = geometry.current?.getAttribute('color')
		const positions = geometry.current?.getAttribute('position')
		if (!vertexColors || !positions) return false

		if (positions.array.length / vertexColors.array.length !== 0.75) return false

		for (let index = 3, length = vertexColors.array.length; index < length; index += 4) {
			if (vertexColors.array[index] < 1) return true
		}

		return false
	})

	$effect(() => {
		material.vertexColors = geometry.current?.getAttribute('color') !== undefined
		material.opacity = opacity.current

		/**
		 * A faded cloud fades through MSAA coverage rather than blending, so it
		 * stays in the opaque pass and the depth buffer orders it.
		 *
		 * Blending would put it in the transparent pass, where three sorts each
		 * object by its `matrixWorld` position. A cloud sits at its own origin
		 * while its points are spread across the scene, and the geometry it
		 * intersects is one `BatchedMesh` with the same problem, so the two cannot
		 * be ordered against each other: the cloud either hides behind geometry it
		 * is in front of, or paints over geometry it is behind. Coverage sidesteps
		 * the sort entirely. It costs smooth alpha, roughly one step per MSAA
		 * sample, which on points reads as the cloud thinning out.
		 */
		if (material.alphaToCoverage !== isFaded) {
			material.alphaToCoverage = isFaded
			material.needsUpdate = true
		}

		invalidate()
	})

	$effect(() => {
		material.depthTest = materialProps.current?.depthTest ?? true
		material.depthWrite = materialProps.current?.depthWrite ?? true

		invalidate()
	})

	$effect(() => {
		if (worldMatrix.current) {
			points.matrix.copy(worldMatrix.current)
			points.updateMatrixWorld()
			invalidate()
		}
	})

	const events = useEntityEvents(() => entity)

	useTask(
		() => {
			// If using an orthographic camera, points need to be
			// resized to half zoom to take up the same screen space.
			material.size = pointSize * ((camera.current as OrthographicCamera).zoom / 2)
		},
		{
			running: () => orthographic,
			autoInvalidate: false,
		}
	)
</script>

{#if geometry.current}
	<T
		is={points}
		name={entity}
		visible={invisible.current !== true}
		renderOrder={renderOrder.current ?? 0}
		{...events}
	>
		<T is={geometry.current} />
		<T is={material} />

		{@render children?.()}
	</T>
{/if}

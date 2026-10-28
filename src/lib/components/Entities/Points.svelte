<script lang="ts">
	import type { Entity } from 'koota'

	import { T, useTask, useThrelte } from '@threlte/core/webgpu'
	import { type Snippet, untrack } from 'svelte'
	import { OrthographicCamera } from 'three'

	import { asColor, isSingleColor } from '$lib/buffer'
	import { traits, useOpacity, useTrait } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { PointCloud } from '$lib/three/PointCloud'

	import { useEntityEvents } from './hooks/useEntityEvents.svelte'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const { camera, invalidate } = useThrelte()
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
		entityPointSize.current ? entityPointSize.current * 0.001 : Number(settings.current.pointSize)
	)
	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	const hasGeometry = $derived(geometry.current !== undefined)

	// Depends on `hasGeometry` alone, so a streamed cloud whose point count changed is swapped
	// into the same instance below rather than rebuilding the material's shader.
	const pointCloud = $derived.by(() => {
		if (!hasGeometry) return undefined
		const cloud = untrack(() => geometry.current)
		return cloud ? new PointCloud(cloud) : undefined
	})

	$effect(() => {
		if (pointCloud && geometry.current) {
			pointCloud.cloud = geometry.current
			invalidate()
		}
	})

	// The cloud geometry used to be a `<T>`, which Threlte disposed on unmount. `PointCloud`
	// keeps it off the scene graph, so dispose it here instead.
	$effect(() => {
		const cloud = geometry.current
		return () => cloud?.dispose()
	})

	$effect(() => {
		if (!pointCloud) return

		pointCloud.matrixAutoUpdate = false
		pointCloud.material.toneMapped = false
	})

	// Orthographic size is driven per frame by the task below, which reads a zoom that isn't
	// reactive. Writing it here too would clobber that between frames.
	$effect(() => {
		if (pointCloud && !orthographic) {
			pointCloud.size.value = pointSize
			invalidate()
		}
	})

	$effect(() => {
		if (!pointCloud) return

		pointCloud.isPerspective.value = orthographic ? 0 : 1
		invalidate()
	})

	$effect(() => {
		if (!pointCloud) return

		pointCloud.maxSize.value = Number(settings.current.maxPointSize)
		invalidate()
	})

	$effect(() => {
		if (!pointCloud) return

		const { material } = pointCloud

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
		if (!pointCloud) return

		const { material } = pointCloud

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
		material.alphaToCoverage = isFaded

		invalidate()
	})

	$effect(() => {
		if (!pointCloud) return

		const { material } = pointCloud

		material.depthTest = materialProps.current?.depthTest ?? true
		material.depthWrite = materialProps.current?.depthWrite ?? true

		invalidate()
	})

	$effect(() => {
		if (pointCloud && worldMatrix.current) {
			pointCloud.matrix.copy(worldMatrix.current)
			pointCloud.updateMatrixWorld()
			invalidate()
		}
	})

	const events = useEntityEvents(() => entity)

	useTask(
		() => {
			if (!pointCloud) return

			// If using an orthographic camera, points need to be
			// resized to half zoom to take up the same screen space.
			pointCloud.size.value = pointSize * ((camera.current as OrthographicCamera).zoom / 2)
		},
		{
			running: () => orthographic,
			autoInvalidate: false,
		}
	)
</script>

{#if pointCloud}
	<T
		is={pointCloud}
		name={entity}
		visible={invisible.current !== true}
		renderOrder={renderOrder.current ?? 0}
		{...events}
	>
		{@render children?.()}
	</T>
{/if}

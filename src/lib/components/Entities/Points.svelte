<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { T, useTask, useThrelte } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { OrthographicCamera, Points, PointsMaterial } from 'three'

	import { asColor, asOpacity, isRgba, isSingleColor } from '$lib/buffer'
	import { traits, useTrait } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { poseToObject3d } from '$lib/transform'

	import { useEntityEvents } from './hooks/useEntityEvents.svelte'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const { camera } = useThrelte()
	const settings = useSettings()

	const parent = useTrait(() => entity, traits.Parent)
	const pose = useTrait(() => entity, traits.Pose)
	const geometry = useTrait(() => entity, traits.BufferGeometry)
	const colors = useTrait(() => entity, traits.Colors)
	const entityPointSize = useTrait(() => entity, traits.PointSize)

	const pointSize = $derived(
		entityPointSize.current ? entityPointSize.current * 0.001 : settings.current.pointSize
	)
	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	const points = new Points()
	const material = points.material as PointsMaterial
	material.toneMapped = false

	$effect.pre(() => {
		material.size = pointSize
	})

	$effect.pre(() => {
		if (geometry.current?.getAttribute('color')) {
			material.color.set(0xffffff)
		} else if (colors.current && isSingleColor(colors.current)) {
			const colorUtil = material.color
			asColor(colors.current, colorUtil, 0)
		} else {
			material.color.set(settings.current.pointColor)
		}
	})

	/**
	 * Points transparancy is very costly for the GPU, so we turn it on conservatively
	 */
	$effect.pre(() => {
		const opacity =
			colors.current && isSingleColor(colors.current) && isRgba(colors.current)
				? asOpacity(colors.current)
				: undefined

		if (opacity !== undefined && opacity < 1) {
			material.transparent = true
			material.opacity = opacity

			return () => {
				material.transparent = false
				material.opacity = 1
			}
		}
	})

	$effect.pre(() => {
		const colors = geometry.current?.getAttribute('color')
		const positions = geometry.current?.getAttribute('position')

		material.vertexColors = colors !== undefined

		if (colors && positions) {
			const hasAlphaChannel = positions.array.length / colors.array.length === 0.75

			let transparent = false
			if (hasAlphaChannel) {
				for (let i = 3, l = colors.array.length; i < l; i += 4) {
					if (colors.array[i] < 1) {
						transparent = true
						break
					}
				}
			}

			material.transparent = transparent
		}
	})

	$effect.pre(() => {
		if (pose.current) {
			poseToObject3d(pose.current, points)
		}
	})

	const events = useEntityEvents(() => entity)
	const shouldResize = $derived(orthographic)

	useTask(
		() => {
			// If using an orthographic camera, points need to be
			// resized to half zoom to take up the same screen space.
			material.size = pointSize * ((camera.current as OrthographicCamera).zoom / 2)
		},
		{
			autoStart: false,
			autoInvalidate: false,
			running: () => shouldResize,
		}
	)

	$effect(() => {
		if (!shouldResize) {
			material.size = pointSize
		}
	})
</script>

{#if geometry.current}
	<Portal id={parent.current}>
		<T
			is={points}
			name={entity}
			bvh={{ maxDepth: 40, maxLeafSize: 20 }}
			{...events}
		>
			<T is={geometry.current} />
			<T is={material} />
			{@render children?.()}
		</T>
	</Portal>
{/if}

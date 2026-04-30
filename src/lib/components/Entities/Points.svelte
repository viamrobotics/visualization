<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { T, useTask, useThrelte } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { OrthographicCamera, Points, PointsMaterial } from 'three'

	import { asColor, isSingleColor } from '$lib/buffer'
	import { traits, useTrait } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { poseToObject3d } from '$lib/transform'

	import AxesHelper from '../AxesHelper.svelte'
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
	const entityColor = useTrait(() => entity, traits.Color)
	const colors = useTrait(() => entity, traits.Colors)
	const entityPointSize = useTrait(() => entity, traits.PointSize)
	const opacity = useTrait(() => entity, traits.Opacity)
	const invisible = useTrait(() => entity, traits.Invisible)
	const showAxesHelper = useTrait(() => entity, traits.ShowAxesHelper)
	const renderOrder = useTrait(() => entity, traits.RenderOrder)
	const materialProps = useTrait(() => entity, traits.Material)

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
		} else if (entityColor.current) {
			const { r, g, b } = entityColor.current
			material.color.setRGB(r, g, b)
		} else if (colors.current && isSingleColor(colors.current)) {
			asColor(colors.current, material.color, 0)
		} else {
			material.color.set(settings.current.pointColor)
		}
	})

	/**
	 * Points transparency is very costly for the GPU, so we turn it on conservatively.
	 * Uniform opacity (entity trait) and per-vertex RGBA alpha are both considered here
	 * to avoid the two sources conflicting with each other.
	 */
	$effect.pre(() => {
		const vertexColors = geometry.current?.getAttribute('color')
		const positions = geometry.current?.getAttribute('position')

		material.vertexColors = vertexColors !== undefined

		const hasUniformOpacity = opacity.current !== undefined && opacity.current < 1
		material.opacity = hasUniformOpacity ? opacity.current! : 1

		let hasVertexAlpha = false
		if (vertexColors && positions) {
			const hasAlphaChannel = positions.array.length / vertexColors.array.length === 0.75
			if (hasAlphaChannel) {
				for (let i = 3, l = vertexColors.array.length; i < l; i += 4) {
					if (vertexColors.array[i] < 1) {
						hasVertexAlpha = true
						break
					}
				}
			}
		}

		material.transparent = hasUniformOpacity || hasVertexAlpha
	})

	$effect.pre(() => {
		material.depthTest = materialProps.current?.depthTest ?? true
		material.depthWrite = materialProps.current?.depthWrite ?? true
	})

	$effect.pre(() => {
		if (pose.current) {
			poseToObject3d(pose.current, points)
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

	$effect(() => {
		if (!orthographic) {
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
			visible={invisible.current !== true}
			renderOrder={renderOrder.current}
			{...events}
		>
			<T is={geometry.current} />
			<T is={material} />
			{#if showAxesHelper.current}
				<AxesHelper
					name={entity}
					width={3}
					length={0.1}
				/>
			{/if}
			{@render children?.()}
		</T>
	</Portal>
{/if}

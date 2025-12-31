<script lang="ts">
	import {
		Points,
		BufferAttribute,
		BufferGeometry,
		PointsMaterial,
		OrthographicCamera,
	} from 'three'
	import { T, useTask, useThrelte } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import { poseToObject3d } from '$lib/transform'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import type { Snippet } from 'svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const { camera } = useThrelte()
	const settings = useSettings()

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const pose = useTrait(() => entity, traits.Pose)
	const positions = useTrait(() => entity, traits.PointsPositions)
	const color = useTrait(() => entity, traits.Color)
	const colors = useTrait(() => entity, traits.VertexColors)
	const opacity = useTrait(() => entity, traits.Opacity)
	const entityPointSize = useTrait(() => entity, traits.PointSize)

	const pointSize = $derived(
		entityPointSize.current ? entityPointSize.current * 0.001 : settings.current.pointSize
	)
	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	const points = new Points()
	const geometry = new BufferGeometry()
	const material = new PointsMaterial()
	material.toneMapped = false

	$effect.pre(() => {
		material.size = pointSize
	})

	$effect.pre(() => {
		if (colors.current) {
			material.color.set(0xffffff)
		} else if (color.current) {
			material.color.setRGB(color.current.r, color.current.g, color.current.b)
		} else {
			material.color.set(settings.current.pointColor)
		}
	})

	/**
	 * Points transparancy is very costly for the GPU, so we turn it on conservatively
	 */
	$effect.pre(() => {
		if (opacity.current && opacity.current < 1) {
			material.transparent = true
			material.opacity = opacity.current

			return () => {
				material.transparent = false
				material.opacity = 1
			}
		}
	})

	$effect.pre(() => {
		if (positions.current) {
			geometry.setAttribute('position', new BufferAttribute(positions.current, 3))
		}
	})

	$effect.pre(() => {
		material.vertexColors = colors.current !== undefined

		if (colors.current && positions.current) {
			const vertexColors = colors.current
			const hasAlphaChannel = positions.current.length / vertexColors.length === 0.75
			const itemSize = hasAlphaChannel ? 4 : 3
			geometry.setAttribute('color', new BufferAttribute(vertexColors, itemSize))
			geometry.attributes.color.needsUpdate = true

			let transparent = false
			if (hasAlphaChannel) {
				for (let i = 3, l = vertexColors.length; i < l; i += 4) {
					if (vertexColors[i] < 1) {
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

	const events = useObjectEvents(() => entity)

	const { start, stop } = useTask(
		() => {
			// If using an orthographic camera, points need to be
			// resized to half zoom to take up the same screen space.
			material.size = pointSize * ((camera.current as OrthographicCamera).zoom / 2)
		},
		{
			autoStart: false,
			autoInvalidate: false,
		}
	)

	$effect(() => {
		if (orthographic) {
			start()
		} else {
			stop()
			material.size = pointSize
		}
	})
</script>

<Portal id={parent.current}>
	<T
		is={points}
		name={name.current}
		{...events}
		bvh={{ maxDepth: 40, maxLeafTris: 20 }}
	>
		<T is={geometry} />
		<T is={material} />
		{@render children?.()}
	</T>
</Portal>

<script lang="ts">
	import {
		Points,
		BufferAttribute,
		BufferGeometry,
		PointsMaterial,
		OrthographicCamera,
	} from 'three'
	import { T, useTask, useThrelte } from '@threlte/core'
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
	const pose = useTrait(() => entity, traits.Pose)
	const positions = useTrait(() => entity, traits.PointsGeometry)
	const color = useTrait(() => entity, traits.Color)
	const colors = useTrait(() => entity, traits.VertexColors)
	const pointSize = $derived(settings.current.pointSize)
	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	const points = new Points()
	const geometry = new BufferGeometry()
	const material = new PointsMaterial()
	material.toneMapped = false

	$effect.pre(() => {
		material.size = pointSize
	})

	$effect.pre(() => {
		if (colors) {
			material.color.set(0xffffff)
		} else if (color.current) {
			material.color.setRGB(color.current.r, color.current.g, color.current.b)
		} else {
			material.color.set(settings.current.pointColor)
		}
	})

	$effect.pre(() => {
		if (positions.current) {
			geometry.setAttribute('position', new BufferAttribute(positions.current, 3))
		}
	})

	$effect.pre(() => {
		material.vertexColors = colors !== undefined

		if (colors.current) {
			geometry.setAttribute('color', new BufferAttribute(colors.current, 3))
			geometry.attributes.color.needsUpdate = true
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

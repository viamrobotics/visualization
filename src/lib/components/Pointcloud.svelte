<script lang="ts">
	import {
		Points,
		BufferAttribute,
		BufferGeometry,
		PointsMaterial,
		OrthographicCamera,
	} from 'three'
	import { PressedKeys } from 'runed'
	import { T, useTask, useThrelte } from '@threlte/core'
	import type { WorldObject } from '$lib/WorldObject'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import { poseToObject3d } from '$lib/transform'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import type { Snippet } from 'svelte'

	interface Props {
		object: WorldObject<{ case: 'points'; value: Float32Array<ArrayBuffer> }>
		children?: Snippet
	}

	let { object, children }: Props = $props()

	const { camera } = useThrelte()
	const settings = useSettings()

	const keys = new PressedKeys()

	const colors = $derived(object.metadata.colors)
	const pointSize = $derived(object.metadata.pointSize ?? settings.current.pointSize)
	const positions = $derived(object.geometry?.value ?? new Float32Array())
	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	const points = new Points()
	const geometry = new BufferGeometry()
	const material = new PointsMaterial()
	material.toneMapped = false

	$effect.pre(() => {
		material.size = pointSize
	})

	$effect.pre(() => {
		material.color.set(colors ? 0xffffff : (object.metadata.color ?? settings.current.pointColor))
	})

	$effect.pre(() => {
		geometry.setAttribute('position', new BufferAttribute(positions, 3))
	})

	$effect.pre(() => {
		material.vertexColors = colors !== undefined

		if (colors) {
			geometry.setAttribute('color', new BufferAttribute(colors, 3))
			geometry.attributes.color.needsUpdate = true
		}
	})

	$effect.pre(() => {
		poseToObject3d(object.pose, points)
	})

	const events = useObjectEvents(() => object.uuid)

	const { start, stop } = useTask(
		() => {
			// If using an orthographic camera, points need to be
			// resized to half zoom to take up the same screen space.
			material.size = pointSize * ((camera.current as OrthographicCamera).zoom / 2)
		},
		{ autoStart: false }
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
	name={object.name}
	uuid={object.uuid}
	{geometry}
	{material}
	{...events}
	bvh={{ maxDepth: 40, maxLeafTris: 20 }}
	onpointermove={keys.has('shift')
		? (event) => {
				console.log(event.point)
			}
		: undefined}
>
	{@render children?.()}
</T>

<script lang="ts">
	import {
		Points as ThreePoints,
		BufferAttribute,
		BufferGeometry,
		PointsMaterial,
		OrthographicCamera,
		Color,
	} from 'three'
	import { T, useTask, useThrelte } from '@threlte/core'
	import { poseToObject3d } from '$lib/transform'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import type { Snippet } from 'svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'
	import { asFloat32Array, STRIDE } from '$lib/buffer'
	import { Portal } from '@threlte/extras'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const { camera } = useThrelte()
	const settings = useSettings()

	const name = useTrait(() => entity, traits.Name)
	const pose = useTrait(() => entity, traits.Pose)
	const positions = useTrait(() => entity, traits.Positions)
	const entityPointSize = useTrait(() => entity, traits.PointSize)
	const colors = useTrait(() => entity, traits.ColorsRGBA)
	const parent = useTrait(() => entity, traits.Parent)
	const points = new ThreePoints()
	const geometry = new BufferGeometry()
	const material = new PointsMaterial()
	material.toneMapped = false

	// Point size in meters (entity value in mm, or settings)
	const pointSize = $derived(
		entityPointSize.current ? entityPointSize.current * 0.001 : settings.current.pointSize
	)

	// Check if we have per-vertex colors (more than one RGBA color)
	const hasVertexColors = $derived.by(() => {
		const colorsData = colors.current
		if (!colorsData) return false
		const positionsData = positions.current
		if (!positionsData) return false

		const numPoints = Math.floor(positionsData.byteLength / 4 / STRIDE.POSITIONS)
		const numColors = Math.floor(colorsData.length / STRIDE.COLORS_RGBA)
		return numColors > 1 && numColors >= numPoints
	})

	$effect.pre(() => {
		material.size = pointSize
	})

	$effect.pre(() => {
		const colorsData = colors.current
		if (hasVertexColors) {
			material.color.set(0xffffff)
		} else if (colorsData && colorsData.length >= 4) {
			material.color.setRGB(colorsData[0] / 255, colorsData[1] / 255, colorsData[2] / 255)
		} else {
			material.color.copy(new Color(settings.current.pointColor))
		}
	})

	$effect.pre(() => {
		const positionsData = positions.current
		if (positionsData && positionsData.length > 0) {
			const floats = asFloat32Array(positionsData)
			// Convert mm to m
			const meters = new Float32Array(floats.length)
			for (let i = 0; i < floats.length; i++) {
				meters[i] = floats[i] * 0.001
			}
			geometry.setAttribute('position', new BufferAttribute(meters, 3))
		}
	})

	$effect.pre(() => {
		material.vertexColors = hasVertexColors

		if (hasVertexColors && colors.current) {
			geometry.setAttribute('color', new BufferAttribute(colors.current, 4))
			geometry.attributes.color.needsUpdate = true
		}
	})

	$effect.pre(() => {
		if (pose.current) {
			poseToObject3d(pose.current, points)
		}
	})

	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	const { start, stop } = useTask(
		() => {
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
		bvh={{ maxDepth: 40, maxLeafTris: 20 }}
	>
		<T is={geometry} />
		<T is={material} />
		{@render children?.()}
	</T>
</Portal>

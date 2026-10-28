<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core/webgpu'
	import { Color } from 'three'
	import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
	import { Line2 } from 'three/examples/jsm/lines/webgpu/Line2.js'
	import { Line2NodeMaterial } from 'three/webgpu'

	interface Props extends ThrelteProps<Line2> {
		length?: number
		width?: number
		axesColors?: [x: string, y: string, z: string]
		depthTest?: boolean
	}

	let {
		length = 1,
		width = 0.1,
		axesColors = ['red', 'green', 'blue'],
		depthTest = true,
		ref = $bindable(),
		...rest
	}: Props = $props()

	const TOTAL_VERTICES = 9
	const VERTEX_COMPONENTS = 3

	const line = new Line2()
	const material = new Line2NodeMaterial()
	const geometry = new LineGeometry()
	const color = new Color()
	const colors = new Float32Array(TOTAL_VERTICES * VERTEX_COMPONENTS)
	const positions = new Float32Array(TOTAL_VERTICES * VERTEX_COMPONENTS)

	$effect.pre(() => {
		for (let i = 0, l = axesColors.length; i < l; i += 1) {
			const axis = axesColors[i]

			color.set(axis)

			const axisBufferStart = i * TOTAL_VERTICES
			const axisBufferEnd = axisBufferStart + TOTAL_VERTICES

			for (let j = axisBufferStart; j < axisBufferEnd; j += VERTEX_COMPONENTS) {
				colors[j + 0] = color.r
				colors[j + 1] = color.g
				colors[j + 2] = color.b
			}
		}

		geometry.setColors(colors)
	})

	const X_AXIS_X_COMPONENT_INDEX = 3
	const Y_AXIS_Y_COMPONENT_INDEX = 13
	const Z_AXIS_Z_COMPONENT_INDEX = 23

	$effect.pre(() => {
		positions[X_AXIS_X_COMPONENT_INDEX] = length
		positions[Y_AXIS_Y_COMPONENT_INDEX] = length
		positions[Z_AXIS_Z_COMPONENT_INDEX] = length
		geometry.setPositions(positions)
	})
</script>

<T
	is={line}
	{...rest}
	bvh={{ enabled: false }}
	bind:ref
>
	<T is={geometry} />
	<T
		is={material}
		vertexColors
		linewidth={width}
		{depthTest}
	/>
</T>

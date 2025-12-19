<script lang="ts">
	import { T } from '@threlte/core'
	import { NURBSCurve } from 'three/addons/curves/NURBSCurve.js'
	import { BufferGeometry, Color, Line, LineBasicMaterial, Vector4 } from 'three'
	import type { Snippet } from 'svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'
	import { asFloat32Array, STRIDE } from '$lib/buffer'
	import { Portal, PortalTarget } from '@threlte/extras'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const controlPoints = useTrait(() => entity, traits.ControlPoints)
	const knots = useTrait(() => entity, traits.Knots)
	const degree = useTrait(() => entity, traits.Degree)
	const weights = useTrait(() => entity, traits.Weights)
	const colors = useTrait(() => entity, traits.ColorsRGBA)
	const line = new Line()
	const geometry = new BufferGeometry()
	const material = new LineBasicMaterial()

	const color = $derived.by(() => {
		const colorsData = colors.current
		if (colorsData && colorsData.length >= 4) {
			return new Color(colorsData[0] / 255, colorsData[1] / 255, colorsData[2] / 255)
		}
		return new Color(0, 1, 1)
	})

	$effect.pre(() => {
		material.color.copy(color)
	})

	$effect.pre(() => {
		const controlPointsData = controlPoints.current
		const knotsData = knots.current
		const weightsData = weights.current
		const curveDegree = degree.current ?? 3

		if (
			!controlPointsData ||
			controlPointsData.length === 0 ||
			!knotsData ||
			knotsData.length === 0
		) {
			return
		}

		const controlPointsFloats = asFloat32Array(controlPointsData)
		const knotsFloats = asFloat32Array(knotsData)
		const weightsFloats = weightsData ? asFloat32Array(weightsData) : null

		const numControlPoints = Math.floor(controlPointsFloats.length / STRIDE.NURBS_CONTROL_POINTS)

		// Build control points as Vector4 (x, y, z, weight)
		// Control points are [x, y, z, ox, oy, oz, theta] - we use x, y, z for position
		// Positions are in mm, convert to m
		const nurbsControlPoints: Vector4[] = []
		for (let i = 0; i < numControlPoints; i++) {
			const offset = i * STRIDE.NURBS_CONTROL_POINTS
			const x = controlPointsFloats[offset] * 0.001
			const y = controlPointsFloats[offset + 1] * 0.001
			const z = controlPointsFloats[offset + 2] * 0.001
			const weight = weightsFloats ? (weightsFloats[i] ?? 1) : 1
			nurbsControlPoints.push(new Vector4(x, y, z, weight))
		}

		// Convert knots to regular array
		const knotsArray = Array.from(knotsFloats)

		try {
			const nurbsCurve = new NURBSCurve(curveDegree, knotsArray, nurbsControlPoints)
			const points = nurbsCurve.getPoints(200)
			geometry.setFromPoints(points)
		} catch (error) {
			console.warn('Failed to create NURBS curve:', error)
		}
	})

	$effect(() => {
		return () => {
			geometry.dispose()
			material.dispose()
		}
	})
</script>

<Portal id={parent.current}>
	<T
		is={line}
		bvh={{ enabled: false }}
		frustumCulled={false}
	>
		<T is={geometry} />
		<T is={material} />
		{@render children?.()}
		<PortalTarget id={name.current} />
	</T>
</Portal>

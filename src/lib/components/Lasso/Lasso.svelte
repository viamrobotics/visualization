<script lang="ts">
	import { Raycaster, Box3, Vector3, Vector2, Plane, Triangle } from 'three'
	import { useThrelte } from '@threlte/core'
	import { Not } from 'koota'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
	import earcut from 'earcut'
	import { traits, useQuery, useWorld } from '$lib/ecs'
	import type { ShapecastCallbacks } from 'three-mesh-bvh'
	import { createBufferGeometry } from '$lib/attribute'
	import * as lassoTraits from './traits'
	import Debug from './Debug.svelte'

	interface Props {
		debug?: boolean
	}

	let { debug = false }: Props = $props()

	const world = useWorld()
	const controls = useCameraControls()
	const { scene, dom, camera } = useThrelte()

	const box3 = new Box3()
	const min = new Vector3()
	const max = new Vector3()

	const triangle = new Triangle()
	const triangleBox = new Box3()
	const a = new Vector3()
	const b = new Vector3()
	const c = new Vector3()

	let frameScheduled = false
	let drawing = false

	const raycaster = new Raycaster()
	const mouse = new Vector2()
	const plane = new Plane(new Vector3(0, 0, 1), 0)
	const point = new Vector3()

	const raycast = (event: PointerEvent) => {
		const element = event.target as HTMLElement
		const rect = element.getBoundingClientRect()
		mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
		mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

		raycaster.setFromCamera(mouse, camera.current)
		raycaster.ray.intersectPlane(plane, point)
		return point
	}

	const onpointerdown = (event: PointerEvent) => {
		if (!event.shiftKey) return

		const { x, y } = raycast(event)

		drawing = true

		world.spawn(
			traits.LinePositions(new Float32Array([x, y, 0])),
			traits.LineWidth(1.5),
			traits.RenderOrder(999),
			traits.Material({ depthTest: false }),
			traits.Color({ r: 1, g: 0, b: 0 }),
			lassoTraits.Box({ minX: x, minY: y, maxX: x, maxY: y }),
			lassoTraits.Lasso
		)

		if (controls.current) {
			controls.current.enabled = false
		}
	}

	const onpointermove = (event: PointerEvent) => {
		if (!drawing) return

		let lasso = world.query(lassoTraits.Lasso).at(-1)

		if (!lasso) return

		if (frameScheduled) return

		frameScheduled = true

		/**
		 * pointermove can execute at a rate much higher than screen
		 * refresh, creating huge polygon vertex counts, so we cap it.
		 */
		requestAnimationFrame(() => {
			frameScheduled = false

			const { x, y } = raycast(event)
			const positions = lasso.get(traits.LinePositions)
			const box = lasso.get(lassoTraits.Box)

			if (!positions || !box) return

			const nextPositions = new Float32Array(positions.length + 3)
			nextPositions.set(positions)
			nextPositions[positions.length] = x
			nextPositions[positions.length + 1] = y
			lasso.set(traits.LinePositions, nextPositions)

			if (x < box.minX) box.minX = x
			else if (x > box.maxX) box.maxX = x

			if (y < box.minY) box.minY = y
			else if (y > box.maxY) box.maxY = y

			lasso.set(lassoTraits.Box, box)
		})
	}

	const onpointerleave = () => {
		if (!drawing) return

		onpointerup()
	}

	const onpointerup = () => {
		if (!drawing) return

		drawing = false

		let lasso = world.query(lassoTraits.Lasso).at(-1)

		if (!lasso) return

		let positions = lasso.get(traits.LinePositions)

		if (!positions) return

		const [startX, startY] = positions

		if (controls.current) {
			controls.current.enabled = true
		}

		// Close the loop
		const nextPositions = new Float32Array(positions.length + 3)
		nextPositions.set(positions)
		nextPositions[positions.length] = startX
		nextPositions[positions.length + 1] = startY
		lasso.set(traits.LinePositions, nextPositions)
		positions = nextPositions

		const indices = earcut(positions, undefined, 3)
		if (debug) {
			lasso.add(lassoTraits.Indices(new Uint16Array(indices)))
		}

		const getTriangleFromIndex = (i: number, triangle: Triangle) => {
			const stride = 3
			const ia = indices[i + 0] * stride
			const ib = indices[i + 1] * stride
			const ic = indices[i + 2] * stride
			a.set(positions[ia + 0], positions[ia + 1], positions[ia + 2])
			b.set(positions[ib + 0], positions[ib + 1], positions[ib + 2])
			c.set(positions[ic + 0], positions[ic + 1], positions[ic + 2])
			triangle.set(a, b, c)
		}

		const boxes: lassoTraits.AABB[] = []
		for (let i = 0, l = indices.length; i < l; i += 3) {
			getTriangleFromIndex(i, triangle)
			box3.setFromPoints([triangle.a, triangle.b, triangle.c])
			boxes.push({ minX: box3.min.x, minY: box3.min.y, maxX: box3.max.x, maxY: box3.max.y })
		}
		if (debug) {
			lasso.add(lassoTraits.Boxes(boxes))
		}

		const lassoBox = lasso.get(lassoTraits.Box)

		if (!lassoBox) return

		min.set(lassoBox.minX, lassoBox.minY, Number.NEGATIVE_INFINITY)
		max.set(lassoBox.maxX, lassoBox.maxY, Number.POSITIVE_INFINITY)
		box3.set(min, max)

		const enclosedPoints: number[] = []

		for (const pointsEntity of world.query(traits.Points, Not(lassoTraits.LassoEnclosedPoints))) {
			const geometry = pointsEntity.get(traits.BufferGeometry)

			if (!geometry) return

			const points = scene.getObjectByName(pointsEntity as unknown as string)

			if (!points) {
				return
			}

			geometry.boundsTree?.shapecast({
				intersectsBounds: (box) => {
					return box.intersectsBox(box3)
				},

				intersectsPoint: (point: Vector3) => {
					for (let i = 0, j = 0, l = indices.length; i < l; i += 3, j += 1) {
						const { minX, minY, maxX, maxY } = boxes[j]

						min.set(minX, minY, Number.NEGATIVE_INFINITY)
						max.set(maxX, maxY, Number.POSITIVE_INFINITY)
						triangleBox.set(min, max)

						if (triangleBox.containsPoint(point)) {
							getTriangleFromIndex(i, triangle)

							if (triangle.containsPoint(point)) {
								enclosedPoints.push(point.x, point.y, point.z)
							}
						}
					}
				},
				// intersectsPoint is not yet in typedef, this can be removed when it is added
			} as ShapecastCallbacks)
		}

		const lassoResultGeometry = createBufferGeometry(new Float32Array(enclosedPoints))

		world.spawn(
			traits.Name('Lasso result'),
			traits.BufferGeometry(lassoResultGeometry),
			traits.Color({ r: 1, g: 0, b: 0 }),
			traits.RenderOrder(999),
			traits.Material({ depthTest: false }),
			traits.Points,
			traits.Removable,
			lassoTraits.LassoEnclosedPoints,
			lassoTraits.PointsCapturedBy(lasso)
		)
	}

	const onkeydown = (event: KeyboardEvent) => {
		if (event.key === 'Shift') {
			dom.style.cursor = 'crosshair'
		}
	}

	const onkeyup = (event: KeyboardEvent) => {
		if (event.key === 'Shift') {
			dom.style.removeProperty('cursor')
		}
	}

	$effect(() => {
		globalThis.addEventListener('keydown', onkeydown)
		globalThis.addEventListener('keyup', onkeyup)
		dom.addEventListener('pointerdown', onpointerdown)
		dom.addEventListener('pointermove', onpointermove)
		dom.addEventListener('pointerup', onpointerup)
		dom.addEventListener('pointerleave', onpointerleave)

		return () => {
			globalThis.removeEventListener('keydown', onkeydown)
			globalThis.removeEventListener('keyup', onkeyup)
			dom.removeEventListener('pointerdown', onpointerdown)
			dom.removeEventListener('pointermove', onpointermove)
			dom.removeEventListener('pointerup', onpointerup)
			dom.removeEventListener('pointerleave', onpointerleave)
		}
	})

	const lassos = useQuery(lassoTraits.Lasso)

	$effect(() => {
		if (!controls.current) return

		const currentControls = controls.current

		const { minPolarAngle, maxPolarAngle } = currentControls

		// Locks the camera to top down while this component is mounted
		currentControls.polarAngle = 0
		currentControls.minPolarAngle = 0
		currentControls.maxPolarAngle = 0

		return () => {
			currentControls.minPolarAngle = minPolarAngle
			currentControls.maxPolarAngle = maxPolarAngle
		}
	})

	// On unmount, destroy all lasso related entities
	$effect(() => {
		return () => {
			for (const entity of world.query(lassoTraits.LassoEnclosedPoints)) {
				if (world.has(entity)) {
					entity.destroy()
				}
			}
		}
	})
</script>

{#if debug}
	{#each lassos.current as lasso (lasso)}
		<Debug {lasso} />
	{/each}
{/if}

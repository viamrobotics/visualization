<script lang="ts">
	import type { ShapecastCallbacks } from 'three-mesh-bvh'

	import { useThrelte } from '@threlte/core'
	import earcut from 'earcut'
	import { Not } from 'koota'
	import { Box3, Triangle, Vector3 } from 'three'

	import { createBufferGeometry } from '$lib/attribute'
	import { traits, useQuery, useWorld } from '$lib/ecs'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'

	import Debug from './Debug.svelte'
	import * as selectionTraits from './traits'
	import { useSelectionPlugin } from './useSelectionPlugin.svelte'
	import { getTriangleBoxesFromIndices, getTriangleFromIndex, raycast } from './utils'

	interface Props {
		active?: boolean
		debug?: boolean
	}

	let { active = false, debug = false }: Props = $props()

	const world = useWorld()
	const controls = useCameraControls()
	const { scene, dom, camera } = useThrelte()
	const selection = useSelectionPlugin()

	const box3 = new Box3()
	const min = new Vector3()
	const max = new Vector3()

	const triangle = new Triangle()
	const triangleBox = new Box3()

	let frameScheduled = false
	let drawing = false

	const onpointerdown = (event: PointerEvent) => {
		if (!event.shiftKey || !active) return

		const { x, y } = raycast(event, camera.current)

		drawing = true

		world.spawn(
			traits.LinePositions(new Float32Array([x, y, 0])),
			selectionTraits.StartPoint({ x, y }),
			traits.LineWidth(1.5),
			traits.RenderOrder(999),
			traits.Material({ depthTest: false }),
			traits.Color({ r: 1, g: 0, b: 0 }),
			selectionTraits.Box({ minX: x, minY: y, maxX: x, maxY: y }),
			selectionTraits.Ellipse
		)

		if (controls.current) {
			controls.current.enabled = false
		}
	}

	const onpointermove = (event: PointerEvent) => {
		if (!drawing || !active) return

		let ellipse = world.query(selectionTraits.Ellipse).at(-1)

		if (!ellipse) return

		if (frameScheduled) return

		frameScheduled = true

		/**
		 * pointermove can execute at a rate much higher than screen
		 * refresh, creating huge polygon vertex counts, so we cap it.
		 */
		requestAnimationFrame(() => {
			frameScheduled = false

			const { x, y } = raycast(event, camera.current)
			const positions = ellipse.get(traits.LinePositions)
			const startPoint = ellipse.get(selectionTraits.StartPoint)
			const box = ellipse.get(selectionTraits.Box)

			if (!positions || !box || !startPoint) return

			let minX = startPoint.x
			let minY = startPoint.y
			let maxX = startPoint.x
			let maxY = startPoint.y

			if (x < minX) minX = x
			else if (x > maxX) maxX = x

			if (y < minY) minY = y
			else if (y > maxY) maxY = y

			const nextPositions = ellipsePoints(minX, maxX, minY, maxY, 100)

			ellipse.set(traits.LinePositions, new Float32Array(nextPositions))
			ellipse.set(selectionTraits.Box, { minX, minY, maxX, maxY })
		})
	}

	const ellipsePoints = (
		minX: number,
		maxX: number,
		minY: number,
		maxY: number,
		numPoints: number
	): Float32Array => {
		const cx = (minX + maxX) / 2
		const cy = (minY + maxY) / 2
		const rx = (maxX - minX) / 2
		const ry = (maxY - minY) / 2

		const points = new Float32Array(numPoints * 3)

		for (let i = 0; i < numPoints; i++) {
			const t = (i / numPoints) * 2 * Math.PI

			points[i * 3] = cx + rx * Math.cos(t)
			points[i * 3 + 1] = cy + ry * Math.sin(t)
			points[i * 3 + 2] = 0
		}

		return points
	}

	const onpointerleave = () => {
		if (!drawing || !active) return

		onpointerup()
	}

	const onpointerup = () => {
		if (!drawing || !active) return

		drawing = false

		let ellipse = world.query(selectionTraits.Ellipse).at(-1)

		if (!ellipse) return

		let positions = ellipse.get(traits.LinePositions)

		if (!positions) return

		if (controls.current) {
			controls.current.enabled = true
		}

		const indices = earcut(positions, undefined, 3)
		if (debug) {
			ellipse.add(selectionTraits.Indices(new Uint16Array(indices)))
		}

		const boxes: selectionTraits.AABB[] = getTriangleBoxesFromIndices(indices, positions)
		if (debug) {
			ellipse.add(selectionTraits.Boxes(boxes))
		}

		const ellipseBox = ellipse.get(selectionTraits.Box)

		if (!ellipseBox) return

		min.set(ellipseBox.minX, ellipseBox.minY, Number.NEGATIVE_INFINITY)
		max.set(ellipseBox.maxX, ellipseBox.maxY, Number.POSITIVE_INFINITY)
		box3.set(min, max)

		const enclosedPoints: number[] = []

		for (const pointsEntity of world.query(
			traits.Points,
			Not(selectionTraits.SelectionEnclosedPoints)
		)) {
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
							getTriangleFromIndex(i, indices, positions, triangle)

							if (triangle.containsPoint(point)) {
								enclosedPoints.push(point.x, point.y, point.z)
							}
						}
					}
				},
				// intersectsPoint is not yet in typedef, this can be removed when it is added
			} as ShapecastCallbacks)
		}

		const ellipseResultGeometry = createBufferGeometry(new Float32Array(enclosedPoints))

		const result = world.spawn(
			traits.Name('Ellipse result'),
			traits.BufferGeometry(ellipseResultGeometry),
			traits.Color({ r: 1, g: 0, b: 0 }),
			traits.RenderOrder(999),
			traits.Material({ depthTest: false }),
			traits.Points,
			traits.Removable,
			selectionTraits.SelectionEnclosedPoints,
			selectionTraits.PointsCapturedBy(ellipse)
		)

		selection.addEntity(result)
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

	const ellipses = useQuery(selectionTraits.Ellipse)

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
			for (const entity of world.query(selectionTraits.SelectionEnclosedPoints)) {
				if (world.has(entity)) {
					entity.destroy()
				}
			}
		}
	})
</script>

{#if debug}
	{#each ellipses.current as ellipse (ellipse)}
		<Debug selection={ellipse} />
	{/each}
{/if}

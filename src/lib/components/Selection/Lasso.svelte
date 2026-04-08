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
	import { getTriangleBoxesFromIndices, getTriangleFromIndex, raycast } from './utils'

	interface Props {
		active?: boolean
		debug?: boolean
	}

	let { active = false, debug = false }: Props = $props()

	const world = useWorld()
	const controls = useCameraControls()
	const { scene, dom, camera } = useThrelte()

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
			traits.LineWidth(1.5),
			traits.ScreenSpace,
			traits.RenderOrder(999),
			traits.Material({ depthTest: false }),
			traits.Color({ r: 1, g: 0, b: 0 }),
			selectionTraits.Box({ minX: x, minY: y, maxX: x, maxY: y }),
			selectionTraits.Lasso
		)

		if (controls.current) {
			controls.current.enabled = false
		}
	}

	const onpointermove = (event: PointerEvent) => {
		if (!drawing || !active) return

		let lasso = world.query(selectionTraits.Lasso).at(-1)

		if (!lasso) return

		if (frameScheduled) return

		frameScheduled = true

		/**
		 * pointermove can execute at a rate much higher than screen
		 * refresh, creating huge polygon vertex counts, so we cap it.
		 */
		requestAnimationFrame(() => {
			frameScheduled = false

			const { x, y } = raycast(event, camera.current)
			const positions = lasso.get(traits.LinePositions)
			const box = lasso.get(selectionTraits.Box)

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

			lasso.set(selectionTraits.Box, box)
		})
	}

	const onpointerleave = () => {
		if (!drawing || !active) return

		onpointerup()
	}

	const onpointerup = () => {
		if (!drawing || !active) return

		drawing = false

		let lasso = world.query(selectionTraits.Lasso).at(-1)

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
			lasso.add(selectionTraits.Indices(new Uint16Array(indices)))
		}

		const boxes: selectionTraits.AABB[] = getTriangleBoxesFromIndices(indices, positions)
		if (debug) {
			lasso.add(selectionTraits.Boxes(boxes))
		}

		const lassoBox = lasso.get(selectionTraits.Box)

		if (!lassoBox) return

		min.set(lassoBox.minX, lassoBox.minY, Number.NEGATIVE_INFINITY)
		max.set(lassoBox.maxX, lassoBox.maxY, Number.POSITIVE_INFINITY)
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

		const lassoResultGeometry = createBufferGeometry(new Float32Array(enclosedPoints), {})

		world.spawn(
			traits.Name('Lasso result'),
			traits.BufferGeometry(lassoResultGeometry),
			traits.Color({ r: 1, g: 0, b: 0 }),
			traits.RenderOrder(999),
			traits.Material({ depthTest: false }),
			traits.Points,
			traits.Removable,
			selectionTraits.SelectionEnclosedPoints,
			selectionTraits.PointsCapturedBy(lasso)
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

	const lassos = useQuery(selectionTraits.Lasso)

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
	{#each lassos.current as lasso (lasso)}
		<Debug selection={lasso} />
	{/each}
{/if}

<script lang="ts">
	import { T, useThrelte } from '@threlte/core'
	import type { IntersectionEvent } from '@threlte/extras'
	import Line from './Line.svelte'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
	import earcut from 'earcut'
	import { Box3, BufferAttribute, Triangle, Vector3, type Points } from 'three'

	interface Props {
		debug?: boolean
	}

	const { scene } = useThrelte()

	let { debug = true }: Props = $props()

	const controls = useCameraControls()

	const triangle = new Triangle()
	const box3 = new Box3()
	const a = new Vector3()
	const b = new Vector3()
	const c = new Vector3()

	let drawing = false

	let position = $state<[number, number, number]>([0, 0, 0])
	let lassos = $state<
		{
			positions: number[]
			indices: Uint16Array
			boxes: Box3[]
			min: { x: number; y: number }
			max: { x: number; y: number }
		}[]
	>([])

	let pending = false

	const onpointerdown = (event: IntersectionEvent<PointerEvent>) => {
		drawing = true

		const { x, y } = event.point

		lassos.push({
			positions: [x, y, 0],
			indices: new Uint16Array(),
			boxes: [],
			min: { x, y },
			max: { x, y },
		})

		if (controls.current) {
			controls.current.enabled = false
		}
	}

	const onpointermove = (event: IntersectionEvent<PointerEvent>) => {
		event.point.toArray(position)

		if (!drawing || pending) return

		let line = lassos.at(-1)

		if (!line) return

		pending = true

		requestAnimationFrame(() => {
			const { x, y } = event.point
			line.positions.push(x, y, 0)
			// line.positions = [...line.positions, x, y, 0]

			if (x < line.min.x) line.min.x = x
			else if (x > line.max.x) line.max.x = x

			if (y < line.min.y) line.min.y = y
			else if (y > line.max.y) line.max.y = y

			pending = false
		})
	}

	const onpointerup = () => {
		drawing = false

		let lasso = lassos.at(-1)

		if (!lasso) return

		const [x, y] = lasso.positions

		if (controls.current) {
			controls.current.enabled = true
		}

		requestAnimationFrame(() => {
			// Close the loop
			const positions = [...lasso.positions, x, y, 0]
			lasso.positions = positions

			const indices = earcut(lasso.positions, undefined, 3)
			lasso.indices = new Uint16Array(indices)

			for (let i = 0; i < indices.length; i += 6) {
				const stride = 3
				const ia = indices[i + 0] * stride
				const ib = indices[i + 1] * stride
				const ic = indices[i + 2] * stride

				a.set(positions[ia + 0], positions[ia + 1], positions[ia + 2])

				b.set(positions[ib + 0], positions[ib + 1], positions[ib + 2])

				c.set(positions[ic + 0], positions[ic + 1], positions[ic + 2])
				triangle.set(c, b, a)

				box3.setFromPoints([a, b, c])

				lasso.boxes.push(box3.clone())
			}

			const allPoints: Points[] = []
			scene.traverse((object) => {
				if ((object as Points).isPoints) {
					allPoints.push(object as Points)
				}
			})
		})
	}
</script>

<T.Mesh
	{onpointerdown}
	{onpointerup}
	{onpointermove}
>
	<T.PlaneGeometry args={[7, 7, 10, 10]} />
	<T.MeshBasicMaterial
		wireframe
		color="blue"
	/>
</T.Mesh>

{#each lassos as lasso (lasso)}
	<Line positions={lasso.positions} />

	{#if debug}
		{#if lasso.indices.length > 0}
			<T.Mesh>
				<T.BufferGeometry
					oncreate={(ref) => {
						ref.setIndex(new BufferAttribute(lasso.indices, 1))
						ref.setAttribute('position', new BufferAttribute(new Float32Array(lasso.positions), 3))
					}}
				/>
				<T.MeshBasicMaterial
					wireframe
					color="green"
				/>
			</T.Mesh>
		{/if}

		{#each lasso.boxes as box (box)}
			<T.Box3Helper args={[box, 'lightgreen']} />
		{/each}

		<T.Box3Helper
			args={[
				new Box3(a.set(lasso.min.x, lasso.min.y, 0), b.set(lasso.max.x, lasso.max.y, 0)),
				'red',
			]}
		/>
	{/if}
{/each}

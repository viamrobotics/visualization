<script lang="ts">
	import { T } from '@threlte/core'
	import { Grid, useGamepad } from '@threlte/extras'
	import { Group, Quaternion, Vector2, Vector3 } from 'three'

	import { useAnchors } from './useAnchors.svelte'
	import { useOrigin } from './useOrigin.svelte'

	const origin = useOrigin()
	const anchors = useAnchors()

	const group = new Group()
	const anchorObject = new Group()

	const leftPad = useGamepad({ xr: true, hand: 'left' })
	const rightPad = useGamepad({ xr: true, hand: 'right' })

	const speed = 0.05

	const vec2 = new Vector2()
	const target = new Vector2()

	leftPad.thumbstick.on('change', ({ value }) => {
		if (typeof value === 'number') {
			return
		}

		const { x: vx, y: vy } = value
		const [x, y, z] = origin.position
		const r = origin.rotation

		origin.set([x, y, z + vy * speed], r + vx * speed)
	})

	rightPad.thumbstick.on('change', ({ value }) => {
		if (typeof value === 'number') {
			return
		}

		const { x: vx, y: vy } = value
		const [x, y, z] = origin.position
		const r = origin.rotation

		vec2.set(x, y).lerp(target.set(x + vx * speed, y + vy * speed), 0.5)

		origin.set([vec2.x, vec2.y, z], r)
	})

	const vec3 = new Vector3()
	const quaternion = new Quaternion()

	$effect(() => {
		vec3.fromArray(origin.position)

		anchors.createAnchor(vec3, quaternion)?.then((anchor) => {
			anchors.bindAnchorObject(anchor, anchorObject)
		})
	})
</script>

<T
	is={group}
	position={[0, 0.05, 0]}
>
	<Grid
		plane="xy"
		position.y={0.05}
		fadeDistance={5}
		fadeOrigin={new Vector3()}
		cellSize={0.1}
		cellColor="#fff"
		sectionColor="#fff"
	/>
</T>

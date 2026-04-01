<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core'
	import { Grid, useGamepad } from '@threlte/extras'
	import { Hand, useHand, useXR } from '@threlte/xr'
	import { Group, Quaternion, Vector2, Vector3 } from 'three'

	import { useAnchors } from './useAnchors.svelte'
	import { useOrigin } from './useOrigin.svelte'

	const origin = useOrigin()
	const anchors = useAnchors()

	const anchorObject = new Group()

	const leftPad = useGamepad({ xr: true, hand: 'left' })
	const rightPad = useGamepad({ xr: true, hand: 'right' })

	let speed = $state(0.05)

	const vec2 = new Vector2()
	const target = new Vector2()

	leftPad.squeeze.on('change', () => {
		speed = leftPad.squeeze.pressed ? 0.005 : 0.05
	})

	leftPad.thumbstick.on('change', ({ value }) => {
		if (typeof value === 'number') {
			return
		}

		const { x: vx, y: vy } = value
		const [x, y, z] = origin.position
		const r = origin.rotation

		vec2.set(z, r).lerp(target.set(z + vy * speed, r + vx * speed), 0.5)

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

	let startPinchTranslation = new Vector3()
	let pinchTranslation = new Vector3()
	let downRotation = 0

	const leftHand = useHand('left')
	const rightHand = useHand('right')

	let translating = $state(false)
	let rotating = $state(false)

	const { renderer } = useThrelte()
	const { isPresenting } = useXR()

	$effect(() => {
		if (!$isPresenting) {
			return
		}
		renderer.xr.getHand(0).addEventListener('pinchstart', () => {
			if (leftHand.current?.targetRay.position) {
				translating = true
				startPinchTranslation.copy(leftHand.current.targetRay.position)
			}
		})
	})

	useTask(
		() => {
			if (leftHand.current?.targetRay && translating) {
				console.log('pinching')
				pinchTranslation.copy(leftHand.current.targetRay.position).sub(startPinchTranslation)
				origin.set(pinchTranslation.toArray(), 0)
			}
		},
		{
			running: () => translating,
		}
	)

	useTask(() => {}, {
		running: () => rotating,
	})
</script>

<Grid
	plane="xy"
	fadeDistance={5}
	fadeOrigin={new Vector3()}
	cellSize={0.1}
	cellColor="#fff"
	sectionColor="#fff"
/>

<Hand
	left
	onpinchstart={() => {
		console.log('pinchstart')
		if (leftHand.current?.targetRay.position) {
			translating = true
			startPinchTranslation.copy(leftHand.current.targetRay.position)
		}
	}}
	onpinchend={() => (translating = false)}
/>

<Hand
	right
	onpinchstart={() => {
		rotating = true
	}}
	onpinchend={() => (rotating = false)}
/>

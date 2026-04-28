<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core'
	import { Grid, useGamepad } from '@threlte/extras'
	import { Hand, useController, useHand, useHeadset, useXR } from '@threlte/xr'
	import { useDebounce } from 'runed'
	import { Euler, Quaternion, Vector3 } from 'three'

	import { usePartID } from '$lib/hooks/usePartID.svelte'

	import { useAnchors } from './useAnchors.svelte'
	import { useOrigin } from './useOrigin.svelte'

	const origin = useOrigin()
	const anchors = useAnchors()
	const partID = usePartID()
	const headset = useHeadset()

	const storageKey = $derived(`xr-origin-anchor:${partID.current}`)

	const DEFAULT_ORIGIN: [number, number, number] = [-1, -1, 0]
	const COMMIT_DEBOUNCE_MS = 500

	const leftPad = useGamepad({ xr: true, hand: 'left' })
	const rightPad = useGamepad({ xr: true, hand: 'right' })
	const leftController = useController('left')
	const rightController = useController('right')

	const THUMBSTICK_SPEED = 0.05

	// Head-relative translation basis. Recomputed per thumbstick tick so
	// stick-forward always moves content away from the viewer, regardless of
	// how the scene was rotated or which way the user is physically facing.
	const headForward = new Vector3()
	const headRight = new Vector3()

	// The anchor that currently represents the persisted origin. Kept so we can
	// delete it when a new calibration is committed.
	let persistedAnchor: XRAnchor | undefined

	// The restored anchor we're waiting to localize on session start. Once the
	// device reports it as tracked we snap origin to its pose and clear this.
	let pendingRestore = $state.raw<XRAnchor | undefined>(undefined)

	const restoreQuat = new Quaternion()
	const restoreEuler = new Euler(0, 0, 0, 'ZYX')

	const commitVec = new Vector3()
	const commitQuat = new Quaternion()

	const commit = useDebounce(async () => {
		// origin.position/rotation define the composed XR reference space's
		// offset from zUp, so an anchor at identity in the current (composed)
		// space IS the anchor at origin's pose in zUp. commitVec/commitQuat
		// are left at their default-constructed zero/identity values.
		const anchor = await anchors.createAnchor(commitVec, commitQuat)
		if (!anchor) return

		const uuid = await anchors.persist(anchor)
		if (!uuid) {
			anchor.delete()
			return
		}

		const prev = localStorage.getItem(storageKey)
		if (prev && prev !== uuid) {
			anchors.remove(prev).catch(() => {})
		}

		if (persistedAnchor && persistedAnchor !== anchor) {
			persistedAnchor.delete()
		}

		persistedAnchor = anchor
		localStorage.setItem(storageKey, uuid)
	}, COMMIT_DEBOUNCE_MS)

	origin.registerCommit(() => commit())

	leftPad.thumbstick.on('change', ({ value }) => {
		// While the grip is held, the left controller drives fine rotation;
		// ignore the thumbstick so the two inputs don't fight each other.
		if (leftPad.squeeze.pressed || typeof value === 'number') return

		const { x: vx, y: vy } = value
		const [x, y, z] = origin.position

		origin.set([x, y, z + vy * THUMBSTICK_SPEED], origin.rotation + vx * THUMBSTICK_SPEED)
		commit()
	})

	rightPad.thumbstick.on('change', ({ value }) => {
		if (rightPad.squeeze.pressed || typeof value === 'number') return

		const { x: vx, y: vy } = value
		const [x, y, z] = origin.position

		headset.getWorldDirection(headForward)

		// Flatten onto the XY (ground) plane so pitch doesn't bleed into horizontal motion.
		headForward.z = 0
		if (headForward.lengthSq() < 1e-6) {
			// Viewer gaze was purely vertical (or pose not yet reported) — fall back to scene +Y.
			headForward.set(0, 1, 0)
		} else {
			headForward.normalize()
		}
		// headForward is in the composed XR reference space; rotate into zUp
		// so the stick direction maps to the user's physical gaze regardless
		// of the current origin rotation.
		origin.toZUpDir(headForward)
		headRight.set(headForward.y, -headForward.x, 0)

		const deltaX = headRight.x * vx * THUMBSTICK_SPEED + headForward.x * vy * THUMBSTICK_SPEED
		const deltaY = headRight.y * vx * THUMBSTICK_SPEED + headForward.y * vy * THUMBSTICK_SPEED

		origin.set([x + deltaX, y + deltaY, z], origin.rotation)
		commit()
	})

	// Fine calibration: hold the grip, then move/rotate the controller to nudge
	// the origin 1:1 with the controller delta. Extract world-Z yaw from the
	// controller quaternion for rotation so pitch/roll don't leak in.
	const quatYaw = (q: Quaternion) =>
		Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))

	const fineTranslateStart = new Vector3()
	const fineTranslateOriginStart = new Vector3()
	const fineTranslateCurrent = new Vector3()
	let fineTranslating = $state(false)

	rightPad.squeeze.on('change', () => {
		const ray = rightController.current?.targetRay
		if (rightPad.squeeze.pressed && ray) {
			// Save start position in zUp so the delta stays stable as the
			// composed reference space recomposes each tick on origin changes.
			origin.toZUpPos(fineTranslateStart, ray.position)
			const [ox, oy, oz] = origin.position
			fineTranslateOriginStart.set(ox, oy, oz)
			fineTranslating = true
		} else {
			fineTranslating = false
		}
	})

	useTask(
		() => {
			const ray = rightController.current?.targetRay
			if (!ray) return
			origin.toZUpPos(fineTranslateCurrent, ray.position)
			origin.set(
				[
					fineTranslateOriginStart.x + fineTranslateCurrent.x - fineTranslateStart.x,
					fineTranslateOriginStart.y + fineTranslateCurrent.y - fineTranslateStart.y,
					fineTranslateOriginStart.z + fineTranslateCurrent.z - fineTranslateStart.z,
				],
				origin.rotation
			)
			commit()
		},
		{ running: () => fineTranslating }
	)

	let fineRotateStartYaw = 0
	let fineRotateOriginStart = 0
	let fineRotating = $state(false)

	leftPad.squeeze.on('change', () => {
		const ray = leftController.current?.targetRay
		if (leftPad.squeeze.pressed && ray) {
			// Controller yaw in composed = yaw_zUp − origin.rotation; convert
			// to zUp so the delta stays stable while origin.rotation updates.
			fineRotateStartYaw = quatYaw(ray.quaternion) + origin.rotation
			fineRotateOriginStart = origin.rotation
			fineRotating = true
		} else {
			fineRotating = false
		}
	})

	useTask(
		() => {
			const ray = leftController.current?.targetRay
			if (!ray) return
			const yawZup = quatYaw(ray.quaternion) + origin.rotation
			origin.set(origin.position, fineRotateOriginStart + yawZup - fineRotateStartYaw)
			commit()
		},
		{ running: () => fineRotating }
	)

	let startLeftPinchTranslation = new Vector3()
	let leftPinchTranslation = new Vector3()
	let startRightPinchTranslation = new Vector3()
	let rightPinchCurrent = new Vector3()
	let startRightPinchRotation = 0

	const leftHand = useHand('left')
	const rightHand = useHand('right')

	let translating = $state(false)
	let rotating = $state(false)

	const { renderer } = useThrelte()
	const { isPresenting } = useXR()

	// Session start: try to restore a persisted anchor for this part. If none
	// exists or restore fails, fall back to a default offset so the origin is
	// visible in front of the user.
	$effect(() => {
		if (!$isPresenting) {
			pendingRestore = undefined
			persistedAnchor = undefined
			return
		}

		const uuid = localStorage.getItem(storageKey)
		if (!uuid) {
			origin.set(DEFAULT_ORIGIN, 0)
			return
		}

		let cancelled = false
		anchors
			.restore(uuid)
			.then((anchor) => {
				if (cancelled) return
				if (anchor) {
					persistedAnchor = anchor
					pendingRestore = anchor
				} else {
					localStorage.removeItem(storageKey)
					origin.set(DEFAULT_ORIGIN, 0)
				}
			})
			.catch(() => {
				if (cancelled) return
				localStorage.removeItem(storageKey)
				origin.set(DEFAULT_ORIGIN, 0)
			})

		return () => {
			cancelled = true
		}
	})

	// Once the restored anchor has localized, snap origin to its pose. This
	// runs only while a restore is pending so it won't fight user input.
	useTask(
		() => {
			const anchor = pendingRestore
			if (!anchor) return

			const pose = anchors.getAnchorPose(anchor)
			if (!pose) return

			const { position: p, orientation: o } = pose.transform
			restoreQuat.set(o.x, o.y, o.z, o.w)
			restoreEuler.setFromQuaternion(restoreQuat, 'ZYX')
			origin.set([p.x, p.y, p.z], restoreEuler.z)
			pendingRestore = undefined
		},
		{
			running: () => pendingRestore !== undefined,
		}
	)

	$effect(() => {
		if (!$isPresenting) {
			return
		}
		renderer.xr.getHand(0).addEventListener('pinchstart', () => {
			const p = leftHand.current?.targetRay.position
			if (p) {
				translating = true
				// Pinch start position in zUp; delta is cumulative from here.
				origin.toZUpPos(startLeftPinchTranslation, p)
			}
		})
	})

	useTask(
		() => {
			const p = leftHand.current?.targetRay.position
			if (p && translating) {
				origin.toZUpPos(leftPinchTranslation, p)
				origin.set(
					[
						leftPinchTranslation.x - startLeftPinchTranslation.x,
						leftPinchTranslation.y - startLeftPinchTranslation.y,
						leftPinchTranslation.z - startLeftPinchTranslation.z,
					],
					origin.rotation
				)
				commit()
			}
		},
		{
			running: () => translating,
		}
	)

	useTask(
		() => {
			const p = rightHand.current?.targetRay.position
			if (p && rotating) {
				origin.toZUpPos(rightPinchCurrent, p)
				const deltaX = rightPinchCurrent.x - startRightPinchTranslation.x
				origin.set(origin.position, startRightPinchRotation + deltaX)
				commit()
			}
		},
		{
			running: () => rotating,
		}
	)
</script>

<Hand
	left
	onpinchstart={() => {
		const p = leftHand.current?.targetRay.position
		if (p) {
			translating = true
			origin.toZUpPos(startLeftPinchTranslation, p)
		}
	}}
	onpinchend={() => (translating = false)}
/>

<Hand
	right
	onpinchstart={() => {
		const p = rightHand.current?.targetRay.position
		if (p) {
			rotating = true
			origin.toZUpPos(startRightPinchTranslation, p)
			startRightPinchRotation = origin.rotation
		}
	}}
	onpinchend={() => (rotating = false)}
/>

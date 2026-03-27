<script lang="ts">
	import { RigidBody as RigidBodyType } from '@dimforge/rapier3d-compat'
	import { T, useTask } from '@threlte/core'
	import { Grid, useGamepad } from '@threlte/extras'
	import { Collider, RigidBody } from '@threlte/rapier'
	import { useController, useXR } from '@threlte/xr'
	import { Euler, Group, Quaternion, Vector3 } from 'three'

	import { useAnchors } from './useAnchors.svelte'
	import { useOrigin } from './useOrigin.svelte'

	const origin = useOrigin()
	const anchors = useAnchors()
	const { isPresenting } = useXR()

	const height = 0.1
	const radius = 0.05

	const group = new Group()
	const innerGroup = new Group()
	const anchorObject = new Group()

	const vec3 = new Vector3()
	const _scale = new Vector3()

	const quaternion = new Quaternion()
	const euler = new Euler()

	const offset = new Vector3()

	const position = new Vector3()

	let dragging = $state(false)
	let rotating = $state(false)
	let currentAnchor: XRAnchor | undefined = $state(undefined)

	$effect(() => {
		if (!$isPresenting) {
			currentAnchor = undefined
		}
	})

	let currentDistance = 0
	const rotateDown = new Vector3()

	let rigidBody = $state<RigidBodyType>()

	const left = useController('left')
	const right = useController('right')

	const leftPad = useGamepad({ xr: true, hand: 'left' })

	leftPad.trigger.on('down', () => {
		const grip = $left?.grip

		if (!grip) {
			return
		}

		dragging = true
		innerGroup.getWorldPosition(vec3)
		offset.copy($left!.grip.position).sub(vec3)
	})
	leftPad.trigger.on('up', () => {
		dragging = false

		if (currentAnchor) {
			anchors.unbindAnchorObject(currentAnchor)
			currentAnchor = undefined
		}

		if (rigidBody) {
			quaternion.copy(rigidBody.rotation() as unknown as Quaternion)
			anchors.createAnchor(position, quaternion)?.then((anchor) => {
				currentAnchor = anchor
				anchors.bindAnchorObject(anchor, anchorObject)
			})
		}
	})

	useTask(
		() => {
			if (!$left || !rigidBody) return

			position.copy($left.grip.position).sub(offset)

			origin.set([position.x, position.y, position.z])

			rigidBody.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z })
		},
		{
			running: () => dragging,
		}
	)

	useTask(
		() => {
			if (!$right || !rigidBody) return

			const distance = rotateDown.distanceToSquared($right.grip.position)

			const rotation = rigidBody.rotation()
			quaternion.copy(rotation)
			euler.setFromQuaternion(quaternion)
			euler.z = distance + currentDistance
			origin.set(undefined, euler.z)

			rigidBody.setNextKinematicRotation(quaternion.setFromEuler(euler))
		},
		{ running: () => rotating }
	)

	useTask(
		() => {
			anchorObject.matrix.decompose(vec3, quaternion, _scale)
			euler.setFromQuaternion(quaternion)
			origin.set([vec3.x, vec3.y, vec3.z], euler.z)
			rigidBody?.setNextKinematicTranslation({ x: vec3.x, y: vec3.y, z: vec3.z })
			rigidBody?.setNextKinematicRotation(quaternion)
		},
		{ running: () => currentAnchor !== undefined && !dragging && !rotating }
	)
</script>

<T
	is={group}
	position={[0, 0.05, 0]}
>
	<RigidBody
		bind:rigidBody
		type="kinematicPosition"
	>
		<Collider
			sensor
			shape="cone"
			args={[height / 2, radius]}
		>
			<T is={innerGroup}>
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
		</Collider>
	</RigidBody>
</T>

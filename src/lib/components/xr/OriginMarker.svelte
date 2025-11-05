<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { Grid, useGamepad } from '@threlte/extras'
	import { Collider, RigidBody } from '@threlte/rapier'
	import { RigidBody as RigidBodyType } from '@dimforge/rapier3d-compat'
	import { useController } from '@threlte/xr'
	import { Euler, Group, Quaternion, Vector3 } from 'three'
	import { useOrigin } from './useOrigin.svelte'

	const origin = useOrigin()

	const height = 0.1
	const radius = 0.05

	const group = new Group()
	const innerGroup = new Group()

	const vec3 = new Vector3()

	const quaternion = new Quaternion()
	const euler = new Euler()

	const offset = new Vector3()

	const position = new Vector3()

	let dragging = $state(false)
	let rotating = $state(false)

	let currentDistance = 0
	const rotateDown = new Vector3()

	let rigidBody = $state<RigidBodyType>()

	const left = useController('left')
	const right = useController('right')

	const leftPad = useGamepad({ xr: true, hand: 'left' })
	const rightPad = useGamepad({ xr: true, hand: 'right' })

	leftPad.trigger.on('down', () => {
		const grip = $left?.grip

		if (!grip) {
			return
		}

		dragging = true
		innerGroup.getWorldPosition(vec3)
		offset.copy($left!.grip.position).sub(vec3)
	})
	leftPad.trigger.on('up', () => (dragging = false))

	rightPad.trigger.on('down', () => {
		const grip = $right?.grip

		if (!grip) {
			return
		}

		rotating = true
		rotateDown.copy($right?.grip.position)
		currentDistance = euler.z
	})
	rightPad.trigger.on('up', () => (rotating = false))

	const dragTask = useTask(
		() => {
			if (!$left || !rigidBody) return

			position.copy($left.grip.position).sub(offset)

			origin.set(position)

			rigidBody.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z })
		},
		{ autoStart: false, autoInvalidate: false }
	)

	const rotateTask = useTask(
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
		{ autoStart: false }
	)

	$effect.pre(() => {
		if (dragging) {
			dragTask.start()
		} else {
			dragTask.stop()
		}
	})

	$effect.pre(() => {
		if (rotating) {
			rotateTask.start()
		} else {
			rotateTask.stop()
		}
	})
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

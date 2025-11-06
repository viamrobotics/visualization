<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { useGamepad } from '@threlte/extras'
	import { useController } from '@threlte/xr'
	import { RigidBody as RigidBodyType } from '@dimforge/rapier3d-compat'
	import type { Snippet } from 'svelte'
	import { Group, Vector3 } from 'three'
	import { AutoColliders, RigidBody } from '@threlte/rapier'

	interface Props {
		children: Snippet
		onPointerEnter?: () => void
		onPointerLeave?: () => void
		onPointerDown?: () => void
		onPointerUp?: () => void
	}

	let { onPointerEnter, onPointerLeave, onPointerDown, onPointerUp, children }: Props = $props()

	let hovering = $state(false)

	let dragging = $state(false)
	let rigidBody: RigidBodyType | undefined = $state()

	const group = new Group()
	const vec3 = new Vector3()
	const offset = new Vector3()
	const position = new Vector3()

	const left = useController('left')
	const right = useController('right')
	const leftPad = useGamepad({ xr: true, hand: 'left' })
	const rightPad = useGamepad({ xr: true, hand: 'right' })

	leftPad.trigger.on('down', () => {
		if (!$left) return

		dragging = true
		group.getWorldPosition(vec3)
		offset.copy($left.grip.position).sub(vec3)
		onPointerDown?.()
	})

	leftPad.trigger.on('up', () => {
		dragging = false
		onPointerUp?.()
	})

	rightPad.trigger.on('down', () => {
		if (!$right) return

		dragging = true
		group.getWorldPosition(vec3)
		offset.copy($right.grip.position).sub(vec3)
		onPointerDown?.()
	})

	rightPad.trigger.on('up', () => {
		dragging = true
		onPointerUp?.()
	})

	const onsensorenter = () => {
		hovering = true
		onPointerEnter?.()
	}

	const onsensorexit = () => {
		hovering = false
		onPointerLeave?.()
	}

	const { start, stop } = useTask(
		() => {
			if (!$left || !rigidBody) return

			position.copy($left.grip.position).sub(offset)

			rigidBody.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z })
		},
		{ autoStart: false }
	)

	$effect(() => (hovering && dragging ? start() : stop()))
</script>

<T is={group}>
	<RigidBody
		bind:rigidBody
		type="kinematicPosition"
	>
		<AutoColliders
			sensor
			shape="convexHull"
			{onsensorenter}
			{onsensorexit}
		>
			{@render children?.()}
		</AutoColliders>
	</RigidBody>
</T>

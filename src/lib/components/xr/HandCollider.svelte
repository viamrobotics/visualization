<script lang="ts">
	import { useParent, useTask } from '@threlte/core'
	import { Collider, useRigidBody } from '@threlte/rapier'
	import type { Group } from 'three'

	const parent = useParent()
	const rb = useRigidBody()

	useTask(() => {
		const { position } = $parent as Group
		rb?.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z })
	})
</script>

<Collider
	sensor
	shape="ball"
	args={[0.1]}
/>

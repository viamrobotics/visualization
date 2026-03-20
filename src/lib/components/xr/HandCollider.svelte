<script lang="ts">
	import type { Group } from 'three'

	import { useParent, useTask } from '@threlte/core'
	import { Collider, useRigidBody } from '@threlte/rapier'

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

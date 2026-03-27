<script lang="ts">
	import { RigidBody } from '@threlte/rapier'
	import { Controller } from '@threlte/xr'

	import HandCollider from '../HandCollider.svelte'
</script>

<Controller left>
	{#snippet grip()}
		<RigidBody type="kinematicPosition">
			<HandCollider />
		</RigidBody>
	{/snippet}
</Controller>

<Controller right>
	{#snippet grip()}
		<RigidBody type="kinematicPosition">
			<HandCollider />
		</RigidBody>
	{/snippet}
</Controller>

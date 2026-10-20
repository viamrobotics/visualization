<script lang="ts">
	import { Button, Input } from '@viamrobotics/prime-core'

	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import KinematicsMissingSources from './KinematicsMissingSources.svelte'

	interface Props {
		workbench: KinematicsWorkbench
		/** Selects the entity with this name once it exists. */
		select: (name: string) => void
	}

	const { workbench, select }: Props = $props()

	const addJoint = () => select(workbench.addJoint({}))
</script>

<div class="flex flex-col gap-2.5 pt-3">
	<label class="text-default flex flex-col gap-1 text-xs">
		Model name
		<Input
			value={workbench.spec.name}
			on:change={(event) => workbench.setName((event.target as HTMLInputElement).value)}
		/>
	</label>

	<p class="text-subtle-1 text-xs">
		root: your component's frame on the robot. Every link and the TCP attach to it.
	</p>

	<KinematicsMissingSources {workbench} />
</div>

<h3 class="text-subtle-2 pt-3 pb-2">Actions</h3>

<Button
	variant="ghost-outline"
	class="w-full"
	onclick={addJoint}
>
	Add joint
</Button>

<script lang="ts">
	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import { attachOptions } from './jointOptions'
	import KinematicsLocalPose from './KinematicsLocalPose.svelte'
	import KinematicsParentPicker from './KinematicsParentPicker.svelte'

	interface Props {
		workbench: KinematicsWorkbench
	}

	const { workbench }: Props = $props()
</script>

<div class="flex flex-col gap-2.5 pt-3">
	<KinematicsParentPicker
		label="Parent"
		value={workbench.spec.tcpParent}
		options={attachOptions(workbench.spec.joints)}
		baseLabel="root"
		onchange={(parent) => workbench.setTcpParent(parent)}
	/>

	<KinematicsLocalPose
		spec={workbench.spec}
		parent={workbench.spec.tcpParent}
		pose={workbench.spec.tcpPose}
		onchange={(pose) => workbench.setTcpPose(pose)}
	/>
</div>

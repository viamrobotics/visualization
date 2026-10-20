<script lang="ts">
	import type { PlainMessage } from '@bufbuild/protobuf'

	import type { Pose } from '$lib/buf/common/v1/common_pb'
	import type { KinematicsSpec } from '$lib/buf/kinematics/v1/spec_pb'

	import PoseFields from '$lib/components/overlay/details/PoseFields.svelte'

	import { toAssembly, toLocal } from '../../kinematics/localPose'
	import { frameToPose, poseToFrame } from './poseFrame'

	interface Props {
		spec: KinematicsSpec
		/** The joint id the pose is relative to, or `''` for the model base. */
		parent: string
		/** The pose in the assembly frame, as the spec stores it. */
		pose: PlainMessage<Pose> | undefined
		/** Called with the edited pose converted back to the assembly frame. */
		onchange: (assemblyPose: PlainMessage<Pose>) => void
	}

	const { spec, parent, pose, onchange }: Props = $props()

	const frame = $derived(poseToFrame(toLocal(spec, parent, pose)))
</script>

<PoseFields
	translation={frame.translation}
	orientation={frame.orientation}
	positionLabel="Origin position"
	orientationLabel="Origin orientation"
	onchange={(next) => onchange(toAssembly(spec, parent, frameToPose(next)))}
/>

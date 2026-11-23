<script lang="ts">
	import type { SharedPose } from './sharedPose'

	import { formatSharedNumber } from './sharedValue'

	interface Props {
		/** Undefined reads as the origin. */
		pose: SharedPose | undefined
	}

	const { pose }: Props = $props()
</script>

<div>
	<strong class="font-semibold">world position</strong>
	<span class="text-subtle-2">(mm)</span>

	<div class="flex gap-3">
		<div>
			<span class="text-subtle-2">x</span>
			{formatSharedNumber(pose?.x ?? 0)}
		</div>
		<div>
			<span class="text-subtle-2">y</span>
			{formatSharedNumber(pose?.y ?? 0)}
		</div>
		<div>
			<span class="text-subtle-2">z</span>
			{formatSharedNumber(pose?.z ?? 0)}
		</div>
	</div>
</div>

<div>
	<strong class="font-semibold">world orientation</strong>
	<span class="text-subtle-2">(deg)</span>
	<div class="flex gap-3">
		<div>
			<span class="text-subtle-2">x</span>
			{formatSharedNumber(pose?.oX ?? 0)}
		</div>
		<div>
			<span class="text-subtle-2">y</span>
			{formatSharedNumber(pose?.oY ?? 0)}
		</div>
		<div>
			<span class="text-subtle-2">z</span>
			{formatSharedNumber(pose?.oZ ?? 0)}
		</div>
		<div>
			<span class="text-subtle-2">th</span>
			{formatSharedNumber(pose?.theta ?? 0)}
		</div>
	</div>
</div>

<script lang="ts">
	import type { Pose } from '$lib/math'

	interface Props {
		/** Undefined reads as the origin. */
		pose: Pose | undefined
	}

	const { pose }: Props = $props()
</script>

<div>
	<strong class="font-semibold">world position</strong>
	<span class="text-subtle-2">(mm)</span>

	<div class="flex gap-3">
		<div>
			<span class="text-subtle-2">x</span>
			{(pose?.x ?? 0).toFixed(2)}
		</div>
		<div>
			<span class="text-subtle-2">y</span>
			{(pose?.y ?? 0).toFixed(2)}
		</div>
		<div>
			<span class="text-subtle-2">z</span>
			{(pose?.z ?? 0).toFixed(2)}
		</div>
	</div>
</div>

<div>
	<strong class="font-semibold">world orientation</strong>
	<span class="text-subtle-2">(deg)</span>
	<div class="flex gap-3">
		<div>
			<span class="text-subtle-2">x</span>
			{(pose?.oX ?? 0).toFixed(2)}
		</div>
		<div>
			<span class="text-subtle-2">y</span>
			{(pose?.oY ?? 0).toFixed(2)}
		</div>
		<div>
			<span class="text-subtle-2">z</span>
			{(pose?.oZ ?? 0).toFixed(2)}
		</div>
		<div>
			<span class="text-subtle-2">th</span>
			{(pose?.theta ?? 0).toFixed(2)}
		</div>
	</div>
</div>

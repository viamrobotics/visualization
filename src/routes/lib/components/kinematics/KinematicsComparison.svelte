<script lang="ts">
	import { Switch } from '@viamrobotics/prime-core'

	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import { formatBytes } from './formatExtent'

	interface Props {
		workbench: KinematicsWorkbench
	}

	let { workbench }: Props = $props()

	const previous = $derived(workbench.previous)
	const report = $derived(workbench.report)
</script>

{#if previous}
	<section
		class="flex flex-col gap-2"
		aria-label="Comparison"
	>
		<h4 class="text-heading text-xs font-semibold">Change from the previous build</h4>

		{#if report}
			<dl class="text-default grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
				<dt class="text-subtle-2">Model size</dt>
				<dd>
					{formatBytes(Number(previous.report.modelBytes))} to {formatBytes(
						Number(report.modelBytes)
					)}
				</dd>
			</dl>
		{/if}

		<label class="text-default flex items-center justify-between gap-2 text-xs">
			Show previous geometry
			<Switch
				on={workbench.showPrevious}
				on:change={(event) => (workbench.showPrevious = event.detail)}
			/>
		</label>
	</section>
{/if}

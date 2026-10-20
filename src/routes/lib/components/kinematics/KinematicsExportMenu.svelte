<script lang="ts">
	import { Button as ActionButton } from '@viamrobotics/prime-core'

	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import Popover from '$lib/components/overlay/Popover.svelte'

	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import KinematicsComparison from './KinematicsComparison.svelte'
	import KinematicsExport from './KinematicsExport.svelte'
	import KinematicsReport from './KinematicsReport.svelte'

	interface Props {
		workbench: KinematicsWorkbench
	}

	let { workbench }: Props = $props()

	const ready = $derived(workbench.status === 'ready' && workbench.report !== undefined)

	const STATUS_LABELS = {
		empty: 'Nothing loaded',
		incomplete: 'Mesh files are missing',
		building: 'Building...',
		error: 'The build failed',
	} as const

	const failures = $derived(workbench.report?.failures ?? [])
	const warnings = $derived(workbench.report?.warnings ?? [])
	const verdict = $derived(
		workbench.status === 'ready'
			? failures.length > 0
				? 'Viam check failed'
				: warnings.length > 0
					? 'Viam check passed with warnings'
					: 'Viam check passed'
			: STATUS_LABELS[workbench.status]
	)
</script>

<Popover placement="bottom-start">
	{#snippet trigger(triggerProps, { isOpen })}
		<Button
			{...triggerProps}
			role="button"
			aria-checked={undefined}
			icon="file-download-outline"
			description={ready ? 'Export' : 'Export (available once a build is ready)'}
			active={isOpen}
			disabled={!ready}
		/>
	{/snippet}

	<div class="font-public-sans flex max-h-[70vh] w-80 flex-col gap-4 overflow-y-auto p-3 text-xs">
		<section
			role="status"
			class="flex flex-col gap-1"
			aria-label="Viam check"
		>
			<p
				class={[
					'text-sm font-semibold',
					failures.length > 0
						? 'text-danger-dark'
						: warnings.length > 0
							? 'text-warning-dark'
							: 'text-heading',
				]}
			>
				{verdict}
			</p>
			{#if workbench.status === 'ready'}
				<p class="text-subtle-1">
					Loads and round-trips the way viam-server reads a module's kinematics.
				</p>
			{/if}
			{#if failures.length > 0}
				<ul
					aria-label="Failures"
					class="text-danger-dark bg-danger-light flex list-disc flex-col gap-1 rounded p-2 pl-6"
				>
					{#each failures as failure (failure)}
						<li>{failure}</li>
					{/each}
				</ul>
			{/if}
		</section>
		{#if workbench.status === 'ready' && failures.length === 0 && warnings.length > 0}
			<div class="flex flex-col gap-2">
				<ul
					aria-label="Warnings"
					class="text-warning-dark bg-warning-light flex list-disc flex-col gap-1 rounded p-2 pl-6"
				>
					{#each warnings as warning (warning)}
						<li>{warning}</li>
					{/each}
				</ul>
				<ActionButton
					variant="ghost-outline"
					onclick={() => workbench.simplifyAll()}
				>
					Simplify all
				</ActionButton>
			</div>
		{/if}
		<KinematicsReport report={workbench.report} />
		<KinematicsComparison {workbench} />
		<KinematicsExport {workbench} />
	</div>
</Popover>

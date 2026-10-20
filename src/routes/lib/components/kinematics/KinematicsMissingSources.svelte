<script lang="ts">
	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import KinematicsSourcePicker from './KinematicsSourcePicker.svelte'

	interface Props {
		workbench: KinematicsWorkbench
	}

	let { workbench }: Props = $props()
</script>

{#if workbench.status === 'incomplete'}
	<section
		class="border-medium flex flex-col gap-2 rounded border p-2"
		aria-label="Missing mesh files"
	>
		<h4 class="text-heading text-xs font-semibold">Missing mesh files</h4>
		<p class="text-subtle-1 text-xs">The project needs these mesh files before it can build.</p>
		<ul class="flex flex-col gap-2">
			{#each workbench.missingSources as path (path)}
				<li class="flex items-center justify-between gap-2">
					<span class="text-subtle-2 font-roboto-mono truncate text-xs">{path}</span>
					<KinematicsSourcePicker
						label="Choose file for {path}"
						text="Choose file"
						onpick={(bytes) => workbench.setSourceBytes(path, bytes)}
					/>
				</li>
			{/each}
		</ul>
	</section>
{/if}

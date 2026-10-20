<script lang="ts">
	import type { ValidationReport } from '$lib/buf/kinematics/v1/spec_pb'

	import { formatBytes, formatExtent } from './formatExtent'
	import { formatPrimitive } from './formatPrimitive'
	import { SHAPE_LABELS } from './unitOptions'

	interface Props {
		report: ValidationReport | undefined
	}

	let { report }: Props = $props()
</script>

<section
	class="flex flex-col gap-2"
	aria-label="Model report"
>
	<h4 class="text-heading text-xs font-semibold">Model report</h4>

	{#if report}
		<dl class="text-default grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
			<dt class="text-subtle-2">Degrees of freedom</dt>
			<dd>{report.dof}</dd>
			<dt class="text-subtle-2">Model size</dt>
			<dd>{formatBytes(Number(report.modelBytes))}</dd>
		</dl>

		<ul class="flex flex-col gap-1">
			{#each report.links as link (link.id)}
				{@const primitive = formatPrimitive(link.primitive)}
				<li class="border-medium text-default flex flex-col gap-0.5 rounded border p-2 text-xs">
					<span class="text-heading font-medium">{link.id}</span>
					{#if primitive}
						<span class="text-subtle-1 font-roboto-mono">{primitive}</span>
					{:else}
						<span class="text-subtle-1">
							{SHAPE_LABELS[link.shape] ?? 'unknown'}, {link.triangles} triangles
						</span>
						<span class="text-subtle-1 font-roboto-mono">{formatExtent(link.extent)}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-subtle-2 text-xs">No report yet.</p>
	{/if}
</section>

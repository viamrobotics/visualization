<script lang="ts">
	import { Banner, BannerVariant, Button, Icon } from '@viamrobotics/prime-core'

	import type { ImportReport } from '$lib/buf/kinematics/v1/spec_pb'

	import OverlayPortal from '$lib/components/overlay/Portals/OverlayPortal.svelte'

	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	interface Props {
		workbench: KinematicsWorkbench
		baseUrl: string
	}

	let { workbench, baseUrl }: Props = $props()

	const report = $derived(workbench.importReport)
	let dismissed: ImportReport | undefined = $state.raw()
	let chosenTcp = $state('')

	const showSummary = $derived(report !== undefined && dismissed !== report)
	const needsTcp = $derived(
		report !== undefined && report.tcpLink === '' && report.tcpCandidates.length > 0
	)
	const selectedTcp = $derived(
		report?.tcpCandidates.includes(chosenTcp) ? chosenTcp : (report?.tcpCandidates[0] ?? '')
	)
	const count = (items: string[], singular: string, plural: string) =>
		`${items.length} ${items.length === 1 ? singular : plural}`

	const failureCount = $derived(workbench.report?.failures.length ?? 0)
</script>

<OverlayPortal>
	<div
		class="font-public-sans pointer-events-none absolute top-14 left-1/2 flex w-96 max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 text-xs"
	>
		<div
			aria-live="polite"
			class="flex flex-col gap-2"
		>
			{#if workbench.status === 'building'}
				<p
					class="text-subtle-1 border-medium flex items-center gap-1.5 rounded border bg-white p-2"
				>
					<Icon
						name="refresh"
						cx="animate-spin motion-reduce:animate-none"
					/>
					Building...
				</p>
			{:else if workbench.status === 'incomplete'}
				<p class="text-subtle-1 border-medium rounded border bg-white p-2">
					Some mesh files are missing. Choose them in the model's details to build.
				</p>
			{:else if workbench.status === 'error'}
				<div
					role="alert"
					class="pointer-events-auto"
				>
					<Banner
						variant={BannerVariant.Danger}
						size="sm"
					>
						{#snippet titleContent()}
							Could not build the model
						{/snippet}
						{#snippet subtitle()}
							<span class="block">{workbench.error}</span>
							<span class="block">
								The draw server at {baseUrl} may not be running. Start it with make up, or use the desktop
								app.
							</span>
						{/snippet}
					</Banner>
				</div>
			{/if}
		</div>

		{#if report && needsTcp}
			<div
				class="border-medium pointer-events-auto flex flex-col gap-2 rounded border bg-white p-2"
			>
				<label
					for="kinematics-import-tcp"
					class="text-default"
				>
					Which link is the TCP?
				</label>
				<select
					id="kinematics-import-tcp"
					class="border-medium rounded border bg-white p-1"
					value={selectedTcp}
					onchange={(event) => (chosenTcp = event.currentTarget.value)}
				>
					{#each report.tcpCandidates as candidate (candidate)}
						<option value={candidate}>{candidate}</option>
					{/each}
				</select>
				<Button
					variant="dark"
					onclick={() => void workbench.chooseImportTcp(selectedTcp)}
				>
					Use as TCP
				</Button>
			</div>
		{/if}

		{#if report && showSummary}
			<section
				aria-label="Import summary"
				class="border-medium pointer-events-auto flex flex-col gap-1 rounded border bg-white p-2"
			>
				<p class="text-default">
					Imported {report.urdfPath}. {count(report.dropped, 'element', 'elements')} dropped, {count(
						report.renamed,
						'item',
						'items'
					)} renamed, {count(report.visualFallbacks, 'visual fallback', 'visual fallbacks')}.
				</p>
				<details>
					<summary class="text-subtle-1 cursor-pointer">Details</summary>
					<ul class="text-subtle-1 flex list-disc flex-col gap-0.5 pl-5">
						{#each report.dropped as item (`dropped ${item}`)}
							<li>Dropped: {item}</li>
						{/each}
						{#each report.renamed as item (`renamed ${item}`)}
							<li>Renamed: {item}</li>
						{/each}
						{#each report.visualFallbacks as item (`fallback ${item}`)}
							<li>Visual fallback: {item}</li>
						{/each}
					</ul>
				</details>
				<Button
					variant="ghost-outline"
					onclick={() => (dismissed = report)}
				>
					Dismiss
				</Button>
			</section>
		{/if}

		{#if failureCount > 0}
			<p
				role="status"
				class="text-danger-dark bg-danger-light rounded p-2"
			>
				The model has {failureCount}
				{failureCount === 1 ? 'problem' : 'problems'}, see Export.
			</p>
		{/if}
	</div>

	{#if workbench.status === 'empty'}
		<p
			class="text-subtle-1 font-public-sans bg-light pointer-events-none absolute top-1/2 left-1/2 w-80 -translate-x-1/2 -translate-y-1/2 rounded p-4 text-center text-sm"
		>
			Drop STL, PLY, OBJ, or DAE mesh files, a project zip, or a folder, or use Add.
		</p>
	{/if}
</OverlayPortal>

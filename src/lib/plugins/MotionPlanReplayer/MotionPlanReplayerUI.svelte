<script lang="ts">
	import type { Snippet } from 'svelte'

	import { Icon, ToastVariant, useToast } from '@viamrobotics/prime-core'
	import { Eye, EyeOff } from 'lucide-svelte'

	import TrajectoryScrubber from '$lib/components/motion/TrajectoryScrubber.svelte'
	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import FloatingPanel from '$lib/components/overlay/FloatingPanel.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'

	import IKInspectionView from './inspect-ik/IKInspectionView.svelte'
	import { useIKInspection } from './inspect-ik/useIKInspection.svelte'
	import { planDropper, type ResolvePlanSnapshots } from './plan-dropper'
	import { useMotionPlanReplayer } from './useMotionPlanReplayer.svelte'

	interface Props {
		children?: Snippet
		resolvePlanSnapshots?: ResolvePlanSnapshots
	}

	const { children, resolvePlanSnapshots }: Props = $props()

	const truncate = (s: string, max = 40): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

	// Module-stable objects: FloatingPanel re-applies `size` whenever the reference changes, so a
	// fresh literal per render would undo the user's manual resizes.
	const REPLAYER_SIZE = { width: 320, height: 260 }
	const INSPECT_SIZE = { width: 380, height: 520 }

	const ctx = useMotionPlanReplayer()
	const ik = useIKInspection()
	const toast = useToast()

	let isOpen = $state(false)
	let fileInput: HTMLInputElement | undefined = $state()
	// resolvePlanSnapshots may round-trip to a server, so uploads are no longer instant.
	let uploadsInFlight = $state(0)

	const handlePlanFile = async (name: string, content: string) => {
		if (ctx.plans.some((p) => p.name === name)) {
			toast({ message: `"${truncate(name, 24)}" already loaded.`, variant: ToastVariant.Warning })
			return
		}

		uploadsInFlight += 1
		try {
			const result = await planDropper({ name, content, resolvePlanSnapshots })

			if (!result.success) {
				toast({ message: result.error.message, variant: ToastVariant.Danger })
				return
			}

			ctx.addPlan(result.name, result.content, result.snapshots)
			isOpen = true
		} finally {
			uploadsInFlight -= 1
		}
	}

	const readAndHandle = (file: File) => {
		const reader = new FileReader()
		reader.addEventListener('load', async (e) => {
			const content = e.target?.result
			if (typeof content === 'string') await handlePlanFile(file.name, content)
		})
		reader.addEventListener('error', () => {
			toast({
				message: `"${truncate(file.name, 24)}" failed to load.`,
				variant: ToastVariant.Danger,
			})
		})
		reader.readAsText(file)
	}

	const onFileChange = (e: Event) => {
		const files = (e.currentTarget as HTMLInputElement).files
		if (!files) return
		for (const file of files) readAndHandle(file)
		if (fileInput) fileInput.value = ''
	}
</script>

<DashboardPortal>
	<fieldset>
		<DashboardButton
			active={isOpen}
			icon="play-circle-outline"
			description="Motion Plan Replayer"
			onclick={() => (isOpen = !isOpen)}
		/>
	</fieldset>
</DashboardPortal>

<!--
	One panel for both modes. Inspect-IK takes the replayer's place rather than opening beside it, so
	the inspected plan's select / delete / scrub controls are out of reach while inspecting — and
	because a second FloatingPanel instance owns its own zag machine, swapping the body is the only
	way to keep the window where the user put it.
-->
<FloatingPanel
	bind:isOpen
	title={ik.isActive ? `IK Inspection · ${ik.planName ?? ''}` : 'Motion Plan Replayer'}
	defaultSize={REPLAYER_SIZE}
	size={ik.isActive ? INSPECT_SIZE : REPLAYER_SIZE}
	minSize={{ width: 300, height: 240 }}
	resizable
>
	{#if ik.isActive}
		<IKInspectionView />
	{:else}
		<div class="flex h-full flex-col gap-1 p-2 text-xs">
			{#if ctx.plans.length === 0}
				<div class="text-subtle-1 flex grow items-center justify-center text-center">
					Use the button below to upload a plan JSON file
				</div>
			{/if}

			{#each ctx.plans as plan, i (plan.name)}
				{@const isActive = ctx.activePlanIndex === i}
				<div
					class={[
						'group flex cursor-pointer items-center gap-1 rounded px-2 py-1',
						isActive ? 'bg-light font-medium' : 'hover:bg-ghost-light',
					]}
					role="button"
					tabindex="0"
					onclick={() => (isActive ? ctx.clearActivePlan() : ctx.selectPlan(i))}
					onkeydown={(e) =>
						e.target === e.currentTarget &&
						e.key === 'Enter' &&
						(isActive ? ctx.clearActivePlan() : ctx.selectPlan(i))}
				>
					<span class="text-subtle-1 mr-1 shrink-0">
						{#if isActive}
							<Eye size={14} />
						{:else}
							<EyeOff size={14} />
						{/if}
					</span>
					<span class="grow truncate">{plan.name}</span>
					<button
						type="button"
						class="text-subtle-1 hover:bg-ghost-light hover:text-default focus-visible:ring-info-dark ml-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:outline-none aria-disabled:opacity-50"
						aria-label={`Inspect IK for ${plan.name}`}
						aria-disabled={ik.status === 'loading'}
						onclick={(e) => {
							e.stopPropagation()
							if (ik.status === 'loading') return
							// Inspect mode takes the panel over, leaving no control for a replayed plan's
							// geometry — so it goes rather than lingering unreachable in the scene.
							ctx.clearActivePlan()
							void ik.inspect(plan.name, plan.content)
						}}
					>
						<Icon
							name="bug-outline"
							size="sm"
							aria-hidden="true"
						/>
					</button>

					<button
						type="button"
						class="text-subtle-1 ml-1 rounded px-1 hover:text-red-500"
						onclick={(e) => {
							e.stopPropagation()
							ctx.removePlan(i)
						}}
						aria-label="Remove plan"
						title="Remove plan">×</button
					>
				</div>

				{#if plan.status === 'error'}
					<div class="pl-5 text-[10px] text-red-600">{plan.error}</div>
				{/if}
				{#if plan.status === 'no-trajectory'}
					<div class="pl-5 text-[10px] text-yellow-600">No trajectory — nothing to replay</div>
				{/if}
			{/each}

			<div class="mt-auto flex flex-col gap-2 pt-1">
    			<TrajectoryScrubber
    				player={ctx.player}
    				label="motion plan"
    			/>
				{@render children?.()}
				<input
					bind:this={fileInput}
					type="file"
					accept=".json"
					class="hidden"
					onchange={onFileChange}
				/>
				<button
					type="button"
					class="border-light text-subtle-1 hover:bg-light w-full rounded border px-2 py-1 aria-disabled:opacity-50"
					aria-disabled={uploadsInFlight > 0}
					onclick={() => uploadsInFlight === 0 && fileInput?.click()}
				>
					{uploadsInFlight > 0 ? 'Uploading…' : 'Upload plan JSON'}
				</button>
			</div>
		</div>
	{/if}
</FloatingPanel>

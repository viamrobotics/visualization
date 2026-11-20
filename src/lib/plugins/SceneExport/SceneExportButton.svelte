<script lang="ts">
	import { Download, LoaderCircle } from 'lucide-svelte'

	import Tooltip from '#lib/components/overlay/Tooltip.svelte'
	import { useWorld } from '#lib/ecs/index.js'
	import { use3DModels } from '#lib/hooks/use3DModels.svelte.js'
	import { useFrames } from '#lib/hooks/useFrames.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'
	import { kinematicsByComponent } from '#lib/kinematicsByComponent.js'
	import { useLogs } from '#lib/plugins/Logs/useLogs.svelte.js'

	import { exportSimScene } from './export-sim-scene'

	const LABEL = 'Export scene as URDF and MJCF'
	const FILE_NAME = 'scene-urdf-mjcf.zip'
	// Firefox and some Safari versions cancel a download whose blob URL is revoked in the same task
	// as the click. FileSaver.js waits this long for the same reason.
	const REVOKE_DELAY_MS = 40_000

	const world = useWorld()
	const frames = useFrames()
	const models = use3DModels()
	const settings = useSettings()
	const logs = useLogs()

	let isExporting = $state(false)

	const download = (blob: Blob) => {
		const url = URL.createObjectURL(blob)
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = FILE_NAME
		document.body.append(anchor)
		anchor.click()
		anchor.remove()
		setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
	}

	const exportScene = async () => {
		isExporting = true
		try {
			const result = await exportSimScene({
				world,
				kinematics: kinematicsByComponent(frames.parts),
				// The export shows what the scene draws, and `GeometryModel` draws arm models only in this mode.
				armModels: settings.current.renderArmModels.includes('model') ? models.current : {},
			})
			download(result.zip)
			logs.add(
				`Exported ${result.bodyCount} bodies as URDF and MJCF, with ${result.noteCount} notes in export-notes.txt.`,
				'info'
			)
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			logs.add(`URDF and MJCF export failed: ${reason}`, 'error')
		} finally {
			isExporting = false
		}
	}
</script>

<Tooltip placement="left">
	{#snippet children(tooltipID)}
		<button
			class="border-gray-5 text-gray-8 hover:bg-light active:bg-medium block rounded-md border bg-white p-1.5 disabled:opacity-50"
			aria-label={LABEL}
			aria-describedby={tooltipID}
			aria-busy={isExporting}
			disabled={isExporting}
			onclick={exportScene}
		>
			{#if isExporting}
				<LoaderCircle
					class="animate-spin"
					size="16"
					aria-hidden="true"
				/>
			{:else}
				<Download
					size="16"
					aria-hidden="true"
				/>
			{/if}
		</button>
	{/snippet}

	{#snippet content()}
		{LABEL}
	{/snippet}
</Tooltip>

<script lang="ts">
	import { Tooltip } from '@viamrobotics/prime-ui'
	import { Download, LoaderCircle } from 'lucide-svelte'

	import type { RawKinematicsModel } from '#lib/kinematicsTransform.js'

	import { traits, useWorld } from '#lib/ecs/index.js'
	import { useEventBus } from '#lib/hooks/useEventBus.js'

	import { exportSimScene } from './export-sim-scene'

	const LABEL = 'Export scene as URDF and MJCF'
	const FILE_NAME = 'scene-urdf-mjcf.zip'
	// Firefox and some Safari versions cancel a download whose blob URL is revoked in the same task
	// as the click. FileSaver.js waits this long for the same reason.
	const REVOKE_DELAY_MS = 40_000

	const world = useWorld()
	const bus = useEventBus()

	/** Each component's kinematics model, keyed by the name of the frame that carries it. */
	const kinematicsByName = (): Record<string, RawKinematicsModel> => {
		const result: Record<string, RawKinematicsModel> = {}
		for (const entity of world.query(traits.Kinematics, traits.Name)) {
			const name = entity.get(traits.Name)
			const model = entity.get(traits.Kinematics)?.model
			if (name !== undefined && model !== undefined) result[name] = model
		}
		return result
	}

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
				kinematics: kinematicsByName(),
			})
			download(result.zip)
			bus.publish('diagnostic', {
				message: `Exported ${result.bodyCount} bodies as URDF and MJCF, with ${result.noteCount} notes in export-notes.txt.`,
				level: 'info',
			})
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			bus.publish('diagnostic', {
				message: `URDF and MJCF export failed: ${reason}`,
				level: 'error',
			})
		} finally {
			isExporting = false
		}
	}
</script>

<Tooltip>
	<Tooltip.Trigger>
		<button
			class="border-gray-5 text-gray-8 hover:bg-light active:bg-medium block rounded-md border bg-white p-1.5 disabled:opacity-50"
			aria-label={LABEL}
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
	</Tooltip.Trigger>
	<Tooltip.Content side="bottom">{LABEL}</Tooltip.Content>
</Tooltip>

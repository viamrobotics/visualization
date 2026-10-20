<script lang="ts">
	import { Button, Input, ToastVariant, useToast } from '@viamrobotics/prime-core'

	import { ExportKind } from '$lib/buf/kinematics/v1/kinematics_service_pb'

	import type {
		ExportedZip,
		KinematicsWorkbench,
	} from '../../kinematics/kinematicsWorkbench.svelte'

	import { saveFile } from '../../tauri/saveFile'

	interface Props {
		workbench: KinematicsWorkbench
	}

	let { workbench }: Props = $props()

	const toast = useToast()

	let namespace = $state('')
	let moduleName = $state('')
	let modelName = $state('')
	let busy = $state(false)

	const specName = $derived(workbench.spec.name)
	const canExport = $derived(workbench.spec.links.length > 0 && !busy)
	const canExportModule = $derived(canExport && namespace.trim() !== '')

	const run = async (request: () => Promise<ExportedZip>) => {
		busy = true
		try {
			const zip = await request()
			const saved = await saveFile(zip.bytes, zip.fileName)
			if (saved) toast({ message: `Saved ${saved}`, variant: ToastVariant.Success })
		} catch (error) {
			toast({
				message: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
				variant: ToastVariant.Danger,
			})
		} finally {
			busy = false
		}
	}

	const downloadPackage = () => run(() => workbench.exportZip(ExportKind.PACKAGE))

	const downloadModule = (event: SubmitEvent) => {
		event.preventDefault()
		return run(() =>
			workbench.exportZip(ExportKind.MODULE, {
				namespace: namespace.trim(),
				moduleName: moduleName.trim() || specName,
				modelName: modelName.trim() || specName,
			})
		)
	}
</script>

<section
	class="flex flex-col gap-2"
	aria-label="Export"
>
	<h4 class="text-heading text-xs font-semibold">Export</h4>

	<Button
		variant="success"
		icon="file-download-outline"
		disabled={!canExport}
		onclick={downloadPackage}
	>
		Add to an existing module
	</Button>

	<form
		class="border-medium rounded border p-2"
		onsubmit={downloadModule}
	>
		<fieldset class="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
			<legend class="text-default mb-2 p-0 text-xs font-medium">New module</legend>

			<label class="text-default flex flex-col gap-1 text-xs">
				Namespace (required)
				<Input
					bind:value={namespace}
					required
				/>
			</label>
			<label class="text-default flex flex-col gap-1 text-xs">
				Module name
				<Input
					bind:value={moduleName}
					placeholder={specName}
				/>
			</label>
			<label class="text-default flex flex-col gap-1 text-xs">
				Viam model
				<Input
					bind:value={modelName}
					placeholder={specName}
				/>
			</label>

			<Button
				type="submit"
				variant="outline-success"
				disabled={!canExportModule}
			>
				Download module
			</Button>
		</fieldset>
	</form>
</section>

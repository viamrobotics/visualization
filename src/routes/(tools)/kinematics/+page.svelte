<script lang="ts">
	import { Button, ToastVariant, useToast } from '@viamrobotics/prime-core'
	import { onDestroy } from 'svelte'

	import Dialog from '$lib/components/overlay/Dialog.svelte'
	import Snapshot from '$lib/components/Snapshot.svelte'
	import { WorldTree } from '$lib/plugins'

	import KinematicsAddMenu from '../../lib/components/kinematics/KinematicsAddMenu.svelte'
	import KinematicsDashboard from '../../lib/components/kinematics/KinematicsDashboard.svelte'
	import KinematicsDetails from '../../lib/components/kinematics/KinematicsDetails.svelte'
	import KinematicsGizmo from '../../lib/components/kinematics/KinematicsGizmo.svelte'
	import KinematicsStatus from '../../lib/components/kinematics/KinematicsStatus.svelte'
	import { routeProjectFiles } from '../../lib/components/kinematics/routeProjectFiles'
	import WorkspaceLink from '../../lib/components/kinematics/WorkspaceLink.svelte'
	import {
		createKinematicsWorkbench,
		type SourceFile,
	} from '../../lib/kinematics/kinematicsWorkbench.svelte'
	import { readDroppedFiles } from '../../lib/kinematics/readDroppedFiles'
	import { useDrawServerUrl } from '../../lib/useDrawServerUrl.svelte'

	const drawServer = useDrawServerUrl()
	const toast = useToast()
	const workbench = createKinematicsWorkbench(() => drawServer.baseUrl)

	onDestroy(() => workbench.destroy())

	/** The scene gizmo's mode, set from the dashboard. Starts on translate so a selection shows a handle. */
	let gizmoMode = $state<'translate' | 'rotate' | undefined>('translate')

	/** A load that replaces the current work, held until the user confirms. */
	let pendingLoad: (() => Promise<void>) | undefined = $state()
	let confirmOpen = $state(false)

	const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))

	const toastMissing = (count: number) => {
		if (count === 0) return
		toast({
			message: `${count} mesh ${count === 1 ? 'file is' : 'files are'} missing. Choose them in the model's details.`,
			variant: ToastVariant.Warning,
		})
	}

	const run = async (load: () => Promise<void>) => {
		try {
			await load()
		} catch (error) {
			toast({
				message: `Could not open the files: ${describeError(error)}`,
				variant: ToastVariant.Danger,
			})
		}
	}

	/** Runs a load that replaces the current work, asking first when there is work to replace. */
	const replaceWork = (load: () => Promise<void>) => {
		if (workbench.spec.links.length === 0) {
			void run(load)
			return
		}
		pendingLoad = load
		confirmOpen = true
	}

	const addFiles = async (files: SourceFile[]) => {
		let route
		try {
			route = routeProjectFiles(files)
		} catch (error) {
			toast({ message: describeError(error), variant: ToastVariant.Danger })
			return
		}

		switch (route.kind) {
			case 'zip': {
				const { file } = route
				replaceWork(async () => {
					await workbench.importZip(file.bytes)
					toastMissing(workbench.missingSources.length)
				})
				break
			}
			case 'project': {
				const { project } = route
				replaceWork(async () => {
					workbench.loadProject(project.spec, project.sources)
					toastMissing(project.missing.length)
				})
				break
			}
			case 'urdf': {
				const { files: urdfFiles } = route
				replaceWork(async () => {
					await workbench.importUrdf({ files: urdfFiles })
				})
				break
			}
			case 'meshes': {
				if (route.files.length < files.length) {
					toast({
						message: 'Only .stl, .ply, .obj, and .dae files were added.',
						variant: ToastVariant.Warning,
					})
				}
				workbench.addSources(route.files)
				break
			}
			default: {
				toast({
					message:
						'Drop .stl, .ply, .obj, or .dae files, a .zip, or a folder with a kinematics.json, or a URDF package.',
					variant: ToastVariant.Warning,
				})
			}
		}
	}

	const confirmLoad = (close: () => void) => {
		const load = pendingLoad
		pendingLoad = undefined
		close()
		if (load) void run(load)
	}

	const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false

	const ondragover = (event: DragEvent) => {
		// Without this the browser refuses the drop and navigates to the file.
		if (hasFiles(event)) event.preventDefault()
	}

	const ondrop = (event: DragEvent) => {
		if (!hasFiles(event)) return
		event.preventDefault()
		const dataTransfer = event.dataTransfer
		if (!dataTransfer) return
		void readDroppedFiles(dataTransfer).then(addFiles, (error: unknown) =>
			toast({
				message: `Could not read the files: ${describeError(error)}`,
				variant: ToastVariant.Danger,
			})
		)
	}
</script>

<svelte:window
	{ondragover}
	{ondrop}
/>

<WorkspaceLink
	route="/"
	label="Viewer"
	icon="arrow-left"
/>

<WorldTree>
	{#snippet addMenu()}
		<KinematicsAddMenu onfiles={addFiles} />
	{/snippet}
</WorldTree>

<Snapshot snapshot={workbench.snapshot} />

<KinematicsDashboard
	{workbench}
	bind:gizmoMode
/>

<KinematicsGizmo
	{workbench}
	mode={gizmoMode}
/>

<KinematicsStatus
	{workbench}
	baseUrl={drawServer.baseUrl}
/>

<KinematicsDetails {workbench} />

<Dialog
	bind:open={confirmOpen}
	title="Replace the current project?"
	description="Opening this project replaces the links and settings you have now."
>
	{#snippet actions({ close })}
		<Button
			variant="ghost-outline"
			onclick={() => {
				pendingLoad = undefined
				close()
			}}
		>
			Cancel
		</Button>
		<Button
			variant="dark"
			onclick={() => confirmLoad(close)}
		>
			Replace
		</Button>
	{/snippet}
</Dialog>

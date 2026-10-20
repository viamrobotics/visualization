<script lang="ts">
	import MenuItem from '$lib/components/overlay/MenuItem.svelte'
	import Popover from '$lib/components/overlay/Popover.svelte'
	import WorldTreeAddButton from '$lib/plugins/WorldTree/WorldTreeAddButton.svelte'

	import type { SourceFile } from '../../kinematics/kinematicsWorkbench.svelte'

	import { readInputFiles } from './readInputFiles'

	interface Props {
		onfiles: (files: SourceFile[]) => void
	}

	let { onfiles }: Props = $props()

	let input: HTMLInputElement | undefined = $state()
	let folderInput: HTMLInputElement | undefined = $state()
	let urdfInput: HTMLInputElement | undefined = $state()

	const onchange = async (event: Event) => {
		const target = event.currentTarget as HTMLInputElement
		const files = [...(target.files ?? [])]
		// Clear it so picking the same file again still fires `change`.
		target.value = ''
		onfiles(await readInputFiles(files))
	}

	const headingId = $props.id()
</script>

<input
	bind:this={input}
	type="file"
	accept=".stl,.ply,.obj,.dae,.zip,.json"
	multiple
	class="sr-only"
	aria-hidden="true"
	data-testid="kinematics-files-input"
	tabindex="-1"
	{onchange}
/>
<input
	bind:this={folderInput}
	type="file"
	webkitdirectory
	class="sr-only"
	aria-hidden="true"
	data-testid="kinematics-folder-input"
	tabindex="-1"
	{onchange}
/>

<input
	bind:this={urdfInput}
	type="file"
	webkitdirectory
	class="sr-only"
	aria-hidden="true"
	data-testid="kinematics-urdf-input"
	tabindex="-1"
	{onchange}
/>

<Popover placement="right-start">
	{#snippet trigger(triggerProps, { isOpen })}
		<WorldTreeAddButton
			{...triggerProps}
			label="Add"
			{isOpen}
		/>
	{/snippet}

	{#snippet children({ close })}
		<div
			role="menu"
			aria-labelledby={headingId}
			class="font-public-sans w-70 pt-1.5 pb-1"
		>
			<p
				id={headingId}
				class="text-subtle-2 px-3 py-0.5 text-xs"
			>
				Add
			</p>

			<hr class="border-light mt-1.5 mb-1.5 shadow-none" />

			<MenuItem
				icon="file-outline"
				label="Add files"
				description="STL, PLY, OBJ, DAE, a .zip, or kinematics.json"
				onclick={() => {
					close()
					input?.click()
				}}
			/>
			<MenuItem
				icon="folder"
				label="Add folder"
				description="A folder of meshes, or a project with its kinematics.json"
				onclick={() => {
					close()
					folderInput?.click()
				}}
			/>
			<MenuItem
				icon="package-variant-closed"
				label="Import URDF or ROS package"
				description="A vendor description package with a .urdf or .xacro and its meshes"
				onclick={() => {
					close()
					urdfInput?.click()
				}}
			/>
		</div>
	{/snippet}
</Popover>

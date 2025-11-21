<script lang="ts">
	import JSONFileDrop from '$lib/components/JSONFileDrop.svelte'
	import Snapshot from '$lib/components/snapshot/Snapshot.svelte'
	import { decodeSnapshotFromJSON, type PassSnapshot } from '$lib/snapshot'
	import { useToast, ToastVariant } from '@viamrobotics/prime-core'

	const toast = useToast()

	let snapshot = $state<PassSnapshot | null>(null)
	let loading = $state(false)

	const handleJSON = async (json: unknown) => {
		snapshot = null
		loading = true

		try {
			await new Promise((resolve) => setTimeout(resolve, 0))
			const decodedSnapshot = decodeSnapshotFromJSON(json)
			snapshot = decodedSnapshot

			toast({
				message: `Loaded snapshot with ${decodedSnapshot.transforms.length} transforms`,
				variant: ToastVariant.Success,
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			toast({
				message: `Failed to load snapshot: ${errorMessage}`,
				variant: ToastVariant.Danger,
			})
		}

		loading = false
	}
</script>

<svelte:head>
	<title>Snapshot Viewer</title>
</svelte:head>

<div class="h-screen w-screen">
	{#if snapshot}
		<Snapshot {snapshot} />
	{:else if loading}
		<div class="flex h-full w-full items-center justify-center bg-gray-50">
			<div class="max-w-lg rounded-lg bg-white p-8 text-center shadow-lg">
				<h1 class="mb-4 text-3xl font-bold text-gray-800">Loading snapshot...</h1>
			</div>
		</div>
	{:else}
		<div class="flex h-full w-full items-center justify-center bg-gray-50">
			<div class="max-w-lg rounded-lg bg-white p-8 text-center shadow-lg">
				<h1 class="mb-4 text-3xl font-bold text-gray-800">Snapshot Viewer</h1>
				<p class="mb-6 text-gray-600">
					Drag and drop a snapshot JSON file to visualize sanding pass data.
				</p>

				<div class="mb-6 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8">
					<svg
						class="mx-auto mb-4 h-16 w-16 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
						/>
					</svg>
					<p class="text-gray-500">Drop snapshot JSON file here</p>
					<p class="mt-2 text-sm text-gray-400">
						Files should be named: <code class="rounded bg-gray-200 px-2 py-1">snapshot_*.json</code
						>
					</p>
				</div>

				<div class="text-left text-sm text-gray-600">
					<h3 class="mb-2 font-semibold">Supported snapshot types:</h3>
					<ul class="ml-4 list-disc space-y-1">
						<li><code>snapshot_trajectory.json</code> - Trajectory visualization</li>
						<li><code>snapshot_failed_execution.json</code> - Failed execution state</li>
					</ul>
				</div>
			</div>
		</div>
	{/if}
</div>

<JSONFileDrop onJSON={handleJSON} />

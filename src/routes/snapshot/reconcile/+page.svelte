<script lang="ts">
	import { asset } from '$app/paths'
	import type { AssetPath } from '$app/types'

	import { DashboardPortal } from '#lib'
	import { Snapshot as SnapshotProto } from '#lib/buf/draw/v1/snapshot_pb.js'
	import Snapshot from '#lib/components/Snapshot.svelte'

	const versions = ['v1', 'v2', 'v3', 'new'] as const

	type Version = (typeof versions)[number]

	const labelFor = (version: Version) => (version === 'new' ? 'Load new' : `Load ${version}`)
	// draw/snapshot_test.go writes these fixtures, so they are missing from the AssetPath
	// union whenever svelte-kit sync runs before the Go tests, as it does in CI.
	const fixturePath = (version: Version) =>
		`test-fixtures/visualization_snapshot_reconcile_${version}.json` as AssetPath
	let snapshot = $state.raw<SnapshotProto | undefined>(undefined)
	let active = $state<Version | undefined>(undefined)

	const load = async (version: Version) => {
		const response = await fetch(asset(fixturePath(version)))

		if (!response.ok) return

		snapshot = SnapshotProto.fromJsonString(await response.text())
		active = version
	}
</script>

<DashboardPortal>
	<fieldset class="flex gap-2">
		{#each versions as version (version)}
			<button
				type="button"
				class={[
					'rounded px-3 py-1 text-xs font-medium',
					active === version
						? 'bg-blue-600 text-white'
						: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
				]}
				onclick={() => load(version)}
			>
				{labelFor(version)}
			</button>
		{/each}
	</fieldset>
</DashboardPortal>

{#if snapshot}
	<Snapshot {snapshot} />
{/if}

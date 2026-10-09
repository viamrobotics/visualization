<script lang="ts">
	import { asset } from '$app/paths'

	import { onMount } from 'svelte'

	import { Snapshot as SnapshotProto } from '#lib/buf/draw/v1/snapshot_pb.js'
	import Snapshot from '#lib/components/Snapshot.svelte'

	let snapshot = $state.raw<SnapshotProto | undefined>(undefined)

	onMount(async () => {
		const response = await fetch(asset('visualization_snapshot.json'))

		if (!response.ok) return

		snapshot = SnapshotProto.fromJsonString(await response.text())
	})
</script>

{#if snapshot}
	<Snapshot {snapshot} />
{/if}

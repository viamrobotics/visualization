<script lang="ts">
	import type { Snapshot as SnapshotProto } from '$lib/buf/draw/v1/snapshot_pb'

	import { provideRelationships } from '$lib/hooks/useRelationships.svelte'

	import Snapshot from '../../Snapshot.svelte'

	interface Props {
		snapshot: SnapshotProto
	}

	const { snapshot }: Props = $props()

	provideRelationships()
</script>

<Snapshot {snapshot} />

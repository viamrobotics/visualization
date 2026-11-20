<script lang="ts">
	import type { Snapshot as SnapshotProto } from '#lib/buf/draw/v1/snapshot_pb.js'

	import { provideRelationships } from '#lib/hooks/useRelationships.svelte.js'

	import Snapshot from '../../Snapshot.svelte'

	interface Props {
		snapshot: SnapshotProto
	}

	const { snapshot }: Props = $props()

	provideRelationships()
</script>

<Snapshot {snapshot} />

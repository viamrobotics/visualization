<script lang="ts">
	import { type Entity } from 'koota'

	import FramePovView from './FramePovView.svelte'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()
</script>

<div class="relative aspect-4/3 w-full">
	<FramePovView {entity} />
</div>

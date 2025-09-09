<script lang="ts">
	import Frame from './Frame.svelte'
	import Label from './Label.svelte'
	import Portal from './portal/Portal.svelte'
	import PortalTarget from './portal/PortalTarget.svelte'
	import { WorldObject } from '$lib/WorldObject.svelte'

	interface Props {
		worldObjects: WorldObject[]
	}

	let { worldObjects }: Props = $props()
</script>

{#each worldObjects as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Frame
			uuid={object.uuid}
			name={object.name}
			pose={object.pose}
			geometry={object.geometry}
			metadata={object.metadata}
		>
			<PortalTarget id={object.name} />
			<Label text={object.name} />
		</Frame>
	</Portal>
{/each}

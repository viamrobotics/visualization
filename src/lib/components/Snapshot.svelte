<script lang="ts">
	import { Portal, PortalTarget } from '$lib/components/portal'
	import { type WorldObject as WorldObjectType } from '$lib/WorldObject.svelte'
	import Label from './Label.svelte'
	import Frame from './Frame.svelte'
	import type { Geometry } from '@viamrobotics/sdk'

	interface Props {
		frames: WorldObjectType<Geometry & { geometryType: { case: undefined; value: undefined } }>[]
		worldObjects: WorldObjectType[]
	}

	let { frames, worldObjects }: Props = $props()
</script>

<!-- First pass: Render all frames to establish PortalTargets -->
{#each frames as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Frame
			{...object}
			units="m"
		>
			<PortalTarget id={object.name} />
			<Label text={object.name} />
		</Frame>
	</Portal>
{/each}

<!-- Second pass: Render geometries into their parent frames -->
{#each worldObjects as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<!-- WorldObjects with geometry can also act as parents for nested children -->
		<Frame
			{...object}
			units="m"
		>
			<PortalTarget id={object.name} />
			<Label text={object.name} />
		</Frame>
	</Portal>
{/each}

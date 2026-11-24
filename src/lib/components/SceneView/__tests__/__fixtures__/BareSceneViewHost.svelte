<script lang="ts">
	import { SceneView } from '../../../../core'
	import SceneProbe from './SceneProbe.svelte'

	interface Props {
		onready: () => void
		onerror: (error: unknown) => void
	}

	let { onready, onerror }: Props = $props()
</script>

<svelte:boundary onerror={(error) => onerror(error)}>
	<SceneView>
		<SceneProbe onready={() => onready()} />
	</SceneView>
</svelte:boundary>

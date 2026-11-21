<script lang="ts">
	import { ScopedScene } from '../../index'
	import SceneProbe from './SceneProbe.svelte'

	interface Props {
		onready: () => void
		onerror: (error: unknown) => void
	}

	let { onready, onerror }: Props = $props()
</script>

<svelte:boundary onerror={(error) => onerror(error)}>
	<ScopedScene>
		<SceneProbe onready={() => onready()} />
	</ScopedScene>
</svelte:boundary>

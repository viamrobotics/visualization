<script lang="ts">
	import type { Snippet } from 'svelte'

	import { Portal } from '@threlte/extras/webgpu'

	interface Props {
		children: Snippet
	}

	let { children }: Props = $props()
</script>

<Portal id="dashboard">
	{@render children()}
</Portal>

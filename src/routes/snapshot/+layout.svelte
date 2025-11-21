<script lang="ts">
	import { provideToast } from '@viamrobotics/prime-core'
	import type { Snippet } from 'svelte'

	interface Props {
		children: Snippet
	}

	let { children }: Props = $props()

	provideToast()
</script>

{@render children()}

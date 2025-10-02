<script lang="ts">
	import { provideWeblabs } from '$lib/hooks/useWeblabs.svelte'

	let { children } = $props()
	provideWeblabs()
</script>

{@render children()}

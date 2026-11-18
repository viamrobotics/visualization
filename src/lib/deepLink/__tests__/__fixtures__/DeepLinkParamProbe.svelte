<script lang="ts">
	import { useDeepLinkParam } from '../../useDeepLink.svelte'

	interface Props {
		key: string
		apply: (values: readonly string[]) => void
	}

	const { key, apply }: Props = $props()

	// A deep link is applied once, in setup, so the initial prop values are the intent.
	// svelte-ignore state_referenced_locally
	useDeepLinkParam(key, apply)
</script>

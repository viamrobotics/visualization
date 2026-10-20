<script lang="ts">
	import type { DialConf } from '@viamrobotics/sdk'
	import type { Snippet } from 'svelte'

	import { providePip } from '@viamrobotics/test-widgets'

	import { provideMachineConnection } from '../hooks/useMachineConnection.svelte'

	interface Props {
		partID: string | undefined
		dialConfig: DialConf | undefined
		children: Snippet
	}

	let { partID, dialConfig, children }: Props = $props()

	provideMachineConnection(
		() => partID ?? '',
		() => dialConfig
	)

	providePip(() => partID ?? '')
</script>

{@render children()}

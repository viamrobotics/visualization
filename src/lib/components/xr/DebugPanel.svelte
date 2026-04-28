<script lang="ts">
	import { Text } from 'threlte-uikit'
	import { Panel } from 'threlte-uikit/horizon'

	import { xrDebug } from './debug.svelte'
	import WristDisplay from './WristDisplay.svelte'

	const messages = $derived(xrDebug.messages)
</script>

<WristDisplay position={[0, 0.005, 0.2]}>
	<Panel
		flexDirection="column"
		padding={12}
		gap={4}
		backgroundColor="#0a0a0a"
		borderRadius={8}
		minWidth={400}
		minHeight={40}
	>
		{#each messages as message, i (i)}
			<Text
				text={message}
				fontSize={14}
				color="#ffffff"
			/>
		{/each}
	</Panel>
</WristDisplay>

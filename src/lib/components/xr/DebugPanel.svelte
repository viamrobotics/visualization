<script lang="ts">
	import { T } from '@threlte/core'
	import { Text } from 'threlte-uikit'
	import { Panel } from 'threlte-uikit/horizon'

	import { xrDebug } from './debug.svelte'
	import HUD from './HUD.svelte'
	import HUDBillboard from './HUDBillboard.svelte'

	const messages = $derived(xrDebug.messages)
</script>

<HUD>
	<HUDBillboard position={[-0.4, 0.25, -0.8]}>
		<T.Group scale={0.1}>
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
		</T.Group>
	</HUDBillboard>
</HUD>

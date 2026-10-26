<script lang="ts">
	import { xrDebug } from './debug.svelte'
	import CanvasPanel from './panels/CanvasPanel.svelte'
	import { panelColumn, panelText } from './panels/panelNode'
	import WristDisplay from './WristDisplay.svelte'

	const root = $derived(
		panelColumn(
			xrDebug.messages.map((message) => panelText(message)),
			{ padding: 12, gap: 4, background: '#0a0a0a', radius: 8, minWidth: 400, minHeight: 40 }
		)
	)
</script>

<WristDisplay position={[0, 0.005, 0.2]}>
	<CanvasPanel {root} />
</WristDisplay>

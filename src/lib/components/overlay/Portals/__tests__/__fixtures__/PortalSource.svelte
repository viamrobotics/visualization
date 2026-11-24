<script lang="ts">
	import { setContext } from 'svelte'

	import DomPortal from '../../DomPortal.svelte'
	import ContextLabel from './ContextLabel.svelte'
	import { SOURCE_LABEL_KEY } from './sourceLabelKey'

	interface Props {
		label: string
	}

	const { label }: Props = $props()

	// svelte-ignore state_referenced_locally
	setContext(SOURCE_LABEL_KEY, label)
</script>

<DomPortal id="target">
	<ContextLabel />
</DomPortal>

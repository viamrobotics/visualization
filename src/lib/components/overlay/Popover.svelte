<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLButtonAttributes } from 'svelte/elements'

	import * as popover from '@zag-js/popover'
	import { normalizeProps, portal, useMachine } from '@zag-js/svelte'

	interface Props {
		trigger: Snippet<[HTMLButtonAttributes]>
		children: Snippet
	}

	let { children, trigger }: Props = $props()

	const id = $props.id()
	const service = useMachine(popover.machine, { id })
	const api = $derived(popover.connect(service, normalizeProps))
</script>

{@render trigger(api.getTriggerProps())}

<div
	use:portal={{ disabled: !api.portalled }}
	{...api.getPositionerProps()}
>
	<div {...api.getContentProps()}>
		{@render children()}
	</div>
</div>

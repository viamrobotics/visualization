<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'
	import * as collapsible from '@zag-js/collapsible'
	import { normalizeProps, useMachine } from '@zag-js/svelte'

	let { children } = $props()

	const id = $props.id()
	const service = useMachine(collapsible.machine, { id })
	const api = $derived(collapsible.connect(service, normalizeProps))
</script>

<div>
	<button
		{...api.getTriggerProps()}
		class="bg-gray-2 m-auto flex w-14 justify-center"
	>
		<Icon
			name="chevron-down"
			cx={api.open ? 'rotate-180' : ''}
		/>
	</button>

	<div {...api.getContentProps()}>
		{@render children()}
	</div>
</div>

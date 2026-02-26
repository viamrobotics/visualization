<script lang="ts">
	import { Portal } from '@threlte/extras'
	import Lasso from './Lasso.svelte'
	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()
	const enabled = $derived(settings.current.interactionMode === 'lasso')
</script>

<Portal id="dashboard">
	<fieldset>
		<Button
			active={enabled}
			icon="selection-drag"
			description="{enabled ? 'Disable' : 'Enable'} lasso selection"
			onclick={() => {
				settings.current.interactionMode = enabled ? 'navigate' : 'lasso'
			}}
		/>
	</fieldset>
</Portal>

{#if enabled}
	<Lasso />
{/if}

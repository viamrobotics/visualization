<script lang="ts">
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'

	import DomPortalTarget from '../Portals/DomPortalTarget.svelte'

	const environment = useEnvironment()

	// One mode is no choice, and zero modes is a bare renderer — either way the
	// toggle has nothing to switch, so hide it entirely.
	const hasChoice = $derived(environment.availableModes.length > 1)
</script>

{#if hasChoice}
	<fieldset
		class="flex"
		role="radiogroup"
		aria-label="Workspace mode"
	>
		<DomPortalTarget id="mode-toggle" />
	</fieldset>
{/if}

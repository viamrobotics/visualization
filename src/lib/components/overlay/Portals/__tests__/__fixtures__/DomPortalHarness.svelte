<script lang="ts">
	import { provideDomPortals } from '#lib/portal.svelte.js'

	import DomPortalTarget from '../../DomPortalTarget.svelte'
	import PortalSource from './PortalSource.svelte'

	interface Props {
		isTargetShown: boolean
		labels: string[]
	}

	const { isTargetShown, labels }: Props = $props()

	provideDomPortals()
</script>

<section aria-label="Target">
	<span>Target's own child</span>
	{#if isTargetShown}
		<DomPortalTarget id="target" />
	{/if}
</section>

<section aria-label="Sources">
	{#each labels as label (label)}
		<PortalSource {label} />
	{/each}
</section>

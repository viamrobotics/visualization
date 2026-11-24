<script lang="ts">
	import { mdiStopCircleOutline } from '@mdi/js'
	import { Icon, useToast } from '@viamrobotics/prime-ui'

	import { useArmClient } from '#lib/hooks/useArmClient.svelte.js'

	interface Props {
		arm: string
		/** Whether the arm's move is running. The button stays visible but disabled otherwise. */
		isMoving: boolean
	}

	const { arm, isMoving }: Props = $props()

	const armClient = useArmClient()
	const toast = useToast()

	// The motion service has no stop for `Move` or `execute`. Stopping the arm fails the request in flight.
	const stop = async () => {
		try {
			await armClient.stop(arm)
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : `Failed to stop "${arm}".`)
		}
	}
</script>

{#if armClient.names.includes(arm)}
	<button
		type="button"
		class="icon-button button-danger button-ghost"
		aria-label={`Stop "${arm}"`}
		aria-disabled={!isMoving || undefined}
		onclick={() => {
			if (isMoving) void stop()
		}}
	>
		<Icon icon={mdiStopCircleOutline} />
	</button>
{/if}

<script lang="ts">
	import { IconButton, ToastVariant, useToast } from '@viamrobotics/prime-core'

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
			toast({
				message: error instanceof Error ? error.message : `Failed to stop "${arm}".`,
				variant: ToastVariant.Danger,
			})
		}
	}
</script>

{#if armClient.names.includes(arm)}
	<IconButton
		icon="stop-circle-outline"
		label={`Stop "${arm}"`}
		variant="danger"
		disabled={!isMoving}
		onclick={() => void stop()}
	/>
{/if}

<script lang="ts">
	import { provideToast, ToastContainer, ToastVariant } from '@viamrobotics/prime-core'
	import { untrack } from 'svelte'

	import { provideWorld } from '#lib/ecs/index.js'
	import { provideFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import { providePartConfig, usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'

	interface Props {
		notifier: 'toast' | 'none'
	}

	let { notifier }: Props = $props()

	const toast = untrack(() => notifier) === 'toast' ? provideToast() : undefined

	provideWorld()
	provideFragmentInfo(
		() => 'part-id',
		() => undefined,
		() => undefined
	)
	providePartConfig(
		() => 'part-id',
		() => undefined,
		toast && ((message) => toast({ message, variant: ToastVariant.Danger }))
	)

	const partConfig = usePartConfig()

	let saved = $state('pending')

	const save = async () => {
		saved = String(await partConfig.save())
	}
</script>

{#if notifier === 'toast'}
	<ToastContainer />
{/if}

<button onclick={save}>Save</button>
<output data-testid="saved">{saved}</output>

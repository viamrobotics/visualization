<script lang="ts">
	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { useHotkey } from '$lib/hooks/useHotkeys.svelte'

	import { provideIsolate } from './provideIsolate.svelte'

	let isolating = $state(false)

	provideIsolate(() => isolating)

	const selected = useQuery(traits.Selected)

	const canIsolate = $derived(selected.current.length > 0 || isolating)

	useHotkey({
		key: '/',
		description: 'Isolate selection',
		when: () => canIsolate,
		run: () => (isolating = !isolating),
	})
</script>

<DashboardPortal>
	<fieldset class="flex">
		<Button
			icon="crop-free"
			active={isolating}
			disabled={!canIsolate}
			description="Isolate selection"
			hotkey="/"
			onclick={() => (isolating = !isolating)}
		/>
	</fieldset>
</DashboardPortal>

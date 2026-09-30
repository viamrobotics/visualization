<script lang="ts">
	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { useHotkey } from '$lib/keybindings'

	import { provideIsolate } from './provideIsolate.svelte'

	let isolating = $state(false)

	provideIsolate(() => isolating)

	const selected = useQuery(traits.Selected)

	const canIsolate = $derived(selected.current.length > 0 || isolating)

	const isolate = useHotkey({
		id: 'view.isolateSelection',
		key: '/',
		description: 'Isolate selection',
		group: 'View',
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
			description={isolate.description}
			keybinding={isolate}
			onclick={() => (isolating = !isolating)}
		/>
	</fieldset>
</DashboardPortal>

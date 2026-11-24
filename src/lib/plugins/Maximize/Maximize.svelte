<script lang="ts">
	import WorkspacePortal from '#lib/components/overlay/Portals/WorkspacePortal.svelte'
	import { useVisualizerRoot } from '#lib/hooks/useVisualizerRoot.svelte.js'

	import MaximizeButton from './MaximizeButton.svelte'

	const root = useVisualizerRoot()

	let maximized = $state(false)

	// Inline, so it wins over the root's own `relative` class. The teardown restores the host's
	// layout on restore and on unmount, so removing the plugin never strands the page covered.
	$effect(() => {
		const element = root.current
		if (!maximized || !element) return

		const { style } = element
		const previous = { position: style.position, inset: style.inset, zIndex: style.zIndex }

		style.position = 'fixed'
		style.inset = '0'
		style.zIndex = 'var(--z-max)'

		return () => {
			style.position = previous.position
			style.inset = previous.inset
			style.zIndex = previous.zIndex
		}
	})
</script>

<WorkspacePortal>
	<MaximizeButton bind:maximized />
</WorkspacePortal>

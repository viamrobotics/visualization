<script lang="ts">
	import { type Snippet, untrack } from 'svelte'

	import DomPortal from './DomPortal.svelte'
	import { settingsTabPortalId, useSettingsTabs } from './useSettingsTabs.svelte'

	interface Props {
		label: string
		/** Where the tab sits among the others, lowest first. Without one, it goes last. */
		order?: number
		children: Snippet
	}

	let { label, order, children }: Props = $props()

	const tabs = useSettingsTabs()

	$effect(() => {
		const tab = { label, order }

		return untrack(() => {
			const currentTabs = tabs.current

			currentTabs.push(tab)
			return () => {
				const index = currentTabs.indexOf(tab)

				if (index !== -1) {
					currentTabs.splice(index, 1)
				}
			}
		})
	})
</script>

<DomPortal id={settingsTabPortalId(label)}>
	{@render children()}
</DomPortal>

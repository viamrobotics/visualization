import type { ResourceName } from '@viamrobotics/sdk'
import type { ResourceAPIWidget } from '@viamrobotics/test-widgets/registry'

import { usePartID } from '$lib/hooks/usePartID.svelte'
import { useResourceByName } from '$lib/hooks/useResourceByName.svelte'

import { resourceWidgetToggles } from './resourceWidgetToggles'
import { useControlWidgets } from './useControlWidgets.svelte'

export interface ResolvedResourceWidget {
	key: string
	resource: ResourceName
	widgetId: string
	label: string
	widgets: ResourceAPIWidget['widgets']
}

const widgetKey = (resourceName: string, widgetId: string) => `${resourceName}__${widgetId}`

/**
 * Resolves the plugin's open-widget list for the current part into renderable
 * registry components. Entries whose resource is momentarily absent (reconnect) or
 * whose widget id no longer exists are skipped from rendering but kept in the store,
 * so panels reappear when the resource returns.
 *
 * Must be called inside `<SceneProviders>`, where `provideResourceByName` runs.
 */
export const useResourceWidgets = () => {
	const store = useControlWidgets()
	const partID = usePartID()
	const resourceByName = useResourceByName()

	const current = $derived.by(() => {
		const open = store.openFor(partID.current)
		const resolved: ResolvedResourceWidget[] = []

		for (const entry of open) {
			const resource = resourceByName.current[entry.resourceName]
			if (!resource) continue

			const toggle = resourceWidgetToggles(resource).find((option) => option.id === entry.widgetId)
			if (!toggle) continue

			resolved.push({
				key: widgetKey(entry.resourceName, entry.widgetId),
				resource,
				widgetId: entry.widgetId,
				label: toggle.label,
				widgets: toggle.widgets,
			})
		}

		return resolved
	})

	return {
		get current() {
			return current
		},
	}
}

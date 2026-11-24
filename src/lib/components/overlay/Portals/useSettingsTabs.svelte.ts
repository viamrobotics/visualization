import { getContext, setContext } from 'svelte'

interface SettingsTab {
	label: string
	/** Where the tab sits among the others, lowest first. A tab without one goes last. */
	order?: number
}

/** The `DomPortal` id a contributed tab's content moves to, inside that tab's panel. */
export const settingsTabPortalId = (label: string): string => `settings-tab:${label}`

interface Context {
	current: SettingsTab[]
}

const key = Symbol('settings-tabs-context')

export const provideSettingsTabs = () => {
	const settingsTabs = $state<SettingsTab[]>([])

	setContext<Context>(key, {
		get current() {
			return settingsTabs
		},
	})
}

export const useSettingsTabs = () => {
	return getContext<Context>(key)
}

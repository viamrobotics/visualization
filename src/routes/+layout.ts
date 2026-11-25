import { browser } from '$app/environment'

import { migrateLegacyStorage } from './lib/migrateLegacyStorage'
import { STANDALONE_STORAGE_KEY } from './lib/standaloneStorageKey'

export const ssr = false
export const prerender = true

// Before the layout mounts the visualizer, which reads the migrated keys on mount.
export const load = async () => {
	if (browser) await migrateLegacyStorage(STANDALONE_STORAGE_KEY)
}

import { migrateLegacyStorage } from './lib/migrateLegacyStorage'
import { STANDALONE_STORAGE_KEY } from './lib/standaloneStorageKey'

export const ssr = false
export const prerender = true

// Before the layout mounts the visualizer, which reads the migrated keys on mount. Skipped
// where there is no storage, such as prerendering.
export const load = async () => {
	if (typeof localStorage !== 'undefined') await migrateLegacyStorage(STANDALONE_STORAGE_KEY)
}

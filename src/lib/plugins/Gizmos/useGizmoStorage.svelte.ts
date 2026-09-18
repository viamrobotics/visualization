import { PersistedState } from 'runed'
import { getContext, setContext } from 'svelte'

const key = Symbol('gizmo-storage-context')

/**
 * Whether placed gizmos survive a reload, and where they are kept. Off by default:
 * a gizmo is a scratch annotation, so persisting one is a deliberate choice rather
 * than the assumed intent.
 *
 * The enabled flag is itself persisted, and both it and the payload are scoped to
 * the machine part, so turning persistence on for one machine does not turn it on
 * for another or leak its gizmos there.
 *
 * @param partID The current machine part, read reactively so a part switch moves to
 * that part's own store rather than carrying the previous one across.
 */
export const provideGizmoStorage = (partID: () => string) => {
	// A fresh PersistedState per part, not one read once at setup: `enabled` is scoped
	// to the part, so a part switch has to move the flag to that part's own key too.
	const enabledStore = $derived(new PersistedState(`${partID()}:gizmos-persist`, false))

	return setContext(key, {
		get partID() {
			return partID()
		},

		get enabled() {
			return enabledStore.current
		},
		set enabled(value) {
			enabledStore.current = value
		},
	})
}

export const useGizmoStorage = () => {
	return getContext<ReturnType<typeof provideGizmoStorage>>(key)
}

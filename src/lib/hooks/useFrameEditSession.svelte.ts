import type { Entity } from 'koota'

import { getContext, setContext } from 'svelte'

import { FrameEditSession } from '$lib/editing/FrameEditSession'

import { usePartConfig } from './usePartConfig.svelte'

const key = Symbol('frame-edit-session-context')

interface FrameEditSessionContext {
	/** The currently-active session, or undefined when no gesture is in flight. */
	current: FrameEditSession | undefined
	/**
	 * Open a new session over the given entities. If a previous session is still
	 * active (e.g. selection changed mid-drag and onMouseUp never fired), it is
	 * aborted first so its snapshot is restored.
	 */
	begin: (entities: Entity[]) => FrameEditSession
}

export const provideFrameEditSession = (partID: () => string) => {
	const partConfig = usePartConfig()
	let active = $state<FrameEditSession | undefined>(undefined)

	const begin = (entities: Entity[]): FrameEditSession => {
		active?.abort()

		const session = new FrameEditSession(
			entities,
			partConfig.updateFrame,
			partConfig.deleteFrame,
			() => {
				if (active === session) active = undefined
			}
		)
		active = session
		return session
	}

	// Drop any in-flight session when the partID changes — its snapshots reference
	// entities from the old world that useFrames will destroy, and aborting it
	// after the swap would write old frame names into the new part's config.
	let lastPartID: string | undefined
	$effect.pre(() => {
		const id = partID()
		if (lastPartID !== undefined && lastPartID !== id) {
			active?.abort()
			active = undefined
		}
		lastPartID = id
	})

	setContext<FrameEditSessionContext>(key, {
		get current() {
			return active
		},
		begin,
	})
}

export const useFrameEditSession = (): FrameEditSessionContext =>
	getContext<FrameEditSessionContext>(key)

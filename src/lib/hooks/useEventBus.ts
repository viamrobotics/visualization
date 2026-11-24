import { getContext, setContext } from 'svelte'

const key = Symbol('event-bus-context')

type DiagnosticLevel = 'info' | 'warn' | 'error'

/**
 * The world tree rows a diagnostic is about. Both may be set: a per-camera point cloud failure is
 * about that camera and about the folder whose poll produced it.
 */
export interface DiagnosticTarget {
	/** A resource, matched against its `traits.Name`. */
	resource?: string
	/** A folder, matched against its `traits.Folder` id. */
	folder?: string
}

/**
 * What the scene announces. Kept small on purpose: each event is a contract every publisher and
 * subscriber shares, and a bus that carries everything hides where data flows.
 */
export interface Events {
	/**
	 * Something worth telling the user happened, such as a fetch starting or failing. `source` is an
	 * id unique to the publishing producer instance, so it can later withdraw exactly its own lines.
	 */
	diagnostic: {
		message: string
		level: DiagnosticLevel
		target?: DiagnosticTarget
		source: string
	}
	/**
	 * Every diagnostic `source` filed no longer holds, such as when a camera the user switched off
	 * stops reporting, or the machine a producer reported on is gone.
	 */
	'diagnostic-cleared': { source: string }
}

type Listener<Name extends keyof Events> = (event: Events[Name]) => void

export interface EventBus {
	/** Hands `event` to every current subscriber of `name`. With none, it goes nowhere. */
	publish<Name extends keyof Events>(name: Name, event: Events[Name]): void
	/** @returns Stops `listener` hearing `name`. */
	subscribe<Name extends keyof Events>(name: Name, listener: Listener<Name>): () => void
}

const createEventBus = (): EventBus => {
	const listeners = new Map<keyof Events, Set<Listener<keyof Events>>>()

	return {
		publish(name, event) {
			for (const listener of listeners.get(name) ?? []) {
				;(listener as Listener<typeof name>)(event)
			}
		},
		subscribe(name, listener) {
			const set = listeners.get(name) ?? new Set()
			set.add(listener as Listener<keyof Events>)
			listeners.set(name, set)
			return () => set.delete(listener as Listener<keyof Events>)
		},
	}
}

/** One bus per scene, so two visualizers on a page never hear each other. */
export const provideEventBus = (): EventBus => {
	const bus = createEventBus()
	setContext<EventBus>(key, bus)
	return bus
}

/** The scene's bus. Outside a scene, a bus nothing else hears, so publishing stays safe. */
export const useEventBus = (): EventBus => {
	return getContext<EventBus | undefined>(key) ?? createEventBus()
}

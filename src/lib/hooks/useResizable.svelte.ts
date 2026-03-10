import { get, set } from 'idb-keyval'

interface Dimensions {
	width: number
	height: number
}

interface Context {
	readonly current: Dimensions
	readonly isLoaded: boolean
	observe: (target: HTMLElement) => void
}

export const MIN_DIMENSIONS: Dimensions = { width: 240, height: 320 }

export const useResizable = (name: () => string, defaultDimensions?: () => Dimensions): Context => {
	const key = $derived(`${name()}-resizable`)

	let dimensions = $derived<Dimensions>(defaultDimensions?.() ?? MIN_DIMENSIONS)
	let loaded = $state(false)
	let observer: ResizeObserver | undefined

	$effect(() => {
		get(key).then((saved: Dimensions | undefined) => {
			if (saved) {
				dimensions = saved
			}
			loaded = true
		})
	})

	const observe = (target: HTMLElement) => {
		// Disconnect previous observer if any
		observer?.disconnect()

		observer = new ResizeObserver((entries) => {
			const entry = entries[0]
			if (!entry) return

			const next = {
				width: Math.max(entry.contentRect.width, MIN_DIMENSIONS.width),
				height: Math.max(entry.contentRect.height, MIN_DIMENSIONS.height),
			}

			set(key, next)
		})

		observer.observe(target)
	}

	const disconnect = () => {
		observer?.disconnect()
	}

	$effect(() => {
		return disconnect
	})

	return {
		get current() {
			return dimensions
		},
		get isLoaded() {
			return loaded
		},
		observe,
	}
}

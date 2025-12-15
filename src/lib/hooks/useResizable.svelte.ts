import {
	resize,
	type ResizeAttributes,
	type ResizeConfig,
	type ResizeDetail,
} from '@svelte-put/resize'
import { get, set } from 'idb-keyval'
import { PersistedState } from 'runed'
import type { Action } from 'svelte/action'
import type { Vector2Like } from 'three'

interface Context {
	style: Partial<CSSStyleDeclaration>
	resize: Action<Element, ResizeConfig | undefined, ResizeAttributes>
	onResized: (event: CustomEvent<ResizeDetail>) => void
}

export const useResizable = (name: () => string, minDimensions: () => Vector2Like): Context => {
	const key = $derived(`${name()}-resizable`)

	const dimensions = new PersistedState<Vector2Like | undefined>(key, undefined)
	let loaded = false

	$effect(() => {
		if (dimensions.current) {
			get(key).then((saved) => {
				if (saved) {
					dimensions.current = saved
				}
				loaded = true
			})
		}
	})

	const onResized = (event: CustomEvent<ResizeDetail>) => {
		if (!loaded) return
		const { width, height } = event.detail.entry.contentRect
		set(key, { x: Math.max(width, minDimensions().x), y: Math.max(height, minDimensions().y) })
	}

	return {
		get style() {
			return {
				minWidth: `${minDimensions().x}px`,
				minHeight: `${minDimensions().y}px`,
				width: `${dimensions.current?.x ?? minDimensions().x}px`,
				height: `${dimensions.current?.y ?? minDimensions().y}px`,
			}
		},
		resize,
		onResized,
	}
}

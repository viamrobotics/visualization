import type { World } from 'koota'
import { useWorld } from './useWorld'

export function useActions<T extends Record<string, (...args: any[]) => any>>(
	actions: (world: World) => T
) {
	const world = useWorld()
	return actions(world)
}

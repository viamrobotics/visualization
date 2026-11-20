import type { SimBody } from './sim-scene'

/** `bodies` grouped by parent name, in their given order. World-rooted bodies are under `undefined`. */
export const childrenByParent = (bodies: Iterable<SimBody>): Map<string | undefined, SimBody[]> => {
	const childrenOf = new Map<string | undefined, SimBody[]>()
	for (const body of bodies) {
		const siblings = childrenOf.get(body.parent)
		if (siblings) siblings.push(body)
		else childrenOf.set(body.parent, [body])
	}
	return childrenOf
}

import { traits, useWorld } from '#lib/ecs/index.js'
import { useFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'

interface TakenResourceNames {
	/**
	 * Every name a new component can't use: the part's components and services, its fragments'
	 * components, and every frame in the scene, including frames from remotes. Collected on each
	 * read, since the scene's frames aren't tracked reactively.
	 */
	readonly current: Set<string>
}

export const useTakenResourceNames = (): TakenResourceNames => {
	const partConfig = usePartConfig()
	const fragmentInfo = useFragmentInfo()
	const world = useWorld()

	return {
		get current() {
			return new Set([
				...(partConfig.current.components ?? []).map(({ name }) => name),
				...(partConfig.current.services ?? []).map(({ name }) => name),
				...Object.keys(fragmentInfo.current ?? {}),
				...world
					.query(traits.FramesAPI, traits.Name)
					.flatMap((entity) => entity.get(traits.Name) ?? []),
			])
		},
	}
}

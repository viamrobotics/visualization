import { setOrAddTrait, traits } from '#lib/ecs/index.js'
import { useFrameEntities } from '#lib/hooks/useFrameEntities.svelte.js'
import { useFrames } from '#lib/hooks/useFrames.svelte.js'
import { kinematicsByComponent } from '#lib/kinematicsByComponent.js'

/**
 * Puts each component's kinematics model on the frame named after that component, as
 * `traits.Kinematics`. A component without a model has none.
 */
export const useKinematicsTraits = (): void => {
	const frames = useFrames()
	const frameEntities = useFrameEntities()

	const models = $derived(kinematicsByComponent(frames.parts))

	$effect(() => {
		for (const [name, entity] of frameEntities.current) {
			const model = models[name]

			if (model === undefined) {
				if (entity.has(traits.Kinematics)) entity.remove(traits.Kinematics)
			} else if (entity.get(traits.Kinematics)?.model !== model) {
				setOrAddTrait(entity, traits.Kinematics, { model })
			}
		}
	})
}

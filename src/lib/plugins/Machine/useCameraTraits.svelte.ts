import { setOrAddTrait, traits } from '#lib/ecs/index.js'
import { useCameraIntrinsics } from '#lib/hooks/useCameraIntrinsics.svelte.js'
import { useFrameEntities } from '#lib/hooks/useFrameEntities.svelte.js'
import { useResourceByName } from '#lib/hooks/useResourceByName.svelte.js'

/**
 * Marks each frame of a camera resource with `traits.Camera`, carrying its intrinsics once
 * `GetProperties` reports them. Fetched once per camera and never polled, since intrinsics are
 * fixed for the life of a camera.
 */
export const useCameraTraits = (): void => {
	const resourceByName = useResourceByName()
	const frames = useFrameEntities()

	const cameraNames = $derived(
		Object.values(resourceByName.current).flatMap((resource) =>
			resource?.subtype === 'camera' ? [resource.name] : []
		)
	)

	const cameraIntrinsics = useCameraIntrinsics(() => cameraNames)

	$effect(() => {
		const cameras = new Set(cameraNames)

		for (const [name, entity] of frames.current) {
			if (!cameras.has(name)) {
				if (entity.has(traits.Camera)) entity.remove(traits.Camera)
				continue
			}

			const intrinsics = cameraIntrinsics.intrinsics(name)
			if (entity.has(traits.Camera) && entity.get(traits.Camera)?.intrinsics === intrinsics)
				continue

			setOrAddTrait(entity, traits.Camera, { intrinsics })
		}
	})
}

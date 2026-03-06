import { poseToObject3d } from '$lib/transform'
import { injectPlugin, useThrelte } from '@threlte/core'

export const posePlugin = () => {
	const { invalidate } = useThrelte()

	injectPlugin('pose', (args) => {
		const { props, ref } = $derived(args)

		if ('pose' in props) {
			$effect(() => {
				if (props.pose) {
					poseToObject3d(props.pose, ref)
					invalidate()
				}
			})
		}
	})
}

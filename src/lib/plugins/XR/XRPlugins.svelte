<script lang="ts">
	import type { Raycaster } from 'three'

	import { pointerControls, touchControls, useController, useHand } from '@threlte/xr'
	import { Vector3 } from 'three'

	interface PointerHandContext {
		hand: 'left' | 'right'
		sourceType: 'controller' | 'hand'
		raycaster: Raycaster
	}

	const POINTS_RAYCAST_THRESHOLD = 0.005

	const controllers = { left: useController('left'), right: useController('right') }
	const hands = { left: useHand('left'), right: useHand('right') }

	const origin = new Vector3()
	const forward = new Vector3()

	const compute = (_context: unknown, { hand, sourceType, raycaster }: PointerHandContext) => {
		const source = sourceType === 'controller' ? controllers[hand].current : hands[hand].current
		const targetRay = source?.targetRay
		if (targetRay === undefined) return

		targetRay.updateWorldMatrix(true, false)
		origin.setFromMatrixPosition(targetRay.matrixWorld)
		forward.set(0, 0, -1).transformDirection(targetRay.matrixWorld)

		raycaster.set(origin, forward)
		raycaster.firstHitOnly = true
		raycaster.params.Points.threshold = POINTS_RAYCAST_THRESHOLD
	}

	pointerControls('left', { compute })
	pointerControls('right', { compute })

	touchControls('left')
	touchControls('right')
</script>

import type { InteractivityProps } from '@threlte/extras'
import type { BVHProps } from 'three-mesh-bvh'

declare global {
	namespace App {}

	namespace Threlte {
		interface UserProps extends InteractivityProps, BVHProps {}
	}
}

export {}

import type { InteractivityProps } from '@threlte/extras'
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { BVHProps } from 'three-mesh-bvh'

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	namespace Threlte {
		interface UserProps extends InteractivityProps, BVHProps {}
	}
}

export {}

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { InteractivityProps, BVHProps } from '@threlte/extras'

declare global {
	// Vite define replacements (set at build time via vite.config.ts)
	const BACKEND_IP: string
	const WS_PORT: string

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

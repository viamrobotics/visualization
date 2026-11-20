import { CameraClient } from '@viamrobotics/sdk'
import { createResourceClient, createResourceQuery } from '@viamrobotics/svelte-sdk'

import { type Intrinsics, isUsableIntrinsics } from '#lib/cameraIntrinsics.js'
import { usePartID } from '#lib/hooks/usePartID.svelte.js'

/**
 * Where a camera's intrinsics stand. `none` is a camera that answered without usable
 * intrinsics, which is different from one still `loading` or one whose request failed.
 */
export type IntrinsicsStatus = 'loading' | 'error' | 'none' | 'ready'

/**
 * Fetches `GetProperties` once for each named camera on the current part. Intrinsics are
 * fixed for the life of a camera, so the reply is never polled.
 *
 * Must be called during setup, inside the part ID provider.
 */
export const useCameraIntrinsics = (names: () => string[]) => {
	const partID = usePartID()

	const queries = $derived(
		names().map((name) => {
			const client = createResourceClient(
				CameraClient,
				() => partID.current,
				() => name
			)
			return [
				name,
				createResourceQuery(client, 'getProperties', { refetchInterval: false }),
			] as const
		})
	)

	const queryFor = (name: string) => queries.find(([queryName]) => queryName === name)?.[1]

	/** Usable intrinsics for `name`, or undefined while there are none to use. */
	const intrinsics = (name: string): Intrinsics | undefined => {
		const reported = queryFor(name)?.data?.intrinsicParameters
		return reported && isUsableIntrinsics(reported) ? reported : undefined
	}

	const status = (name: string): IntrinsicsStatus => {
		const query = queryFor(name)
		if (query === undefined || query.isPending) return 'loading'
		if (query.error) return 'error'
		return intrinsics(name) === undefined ? 'none' : 'ready'
	}

	return { intrinsics, status }
}

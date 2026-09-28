import type { IKSeedGroup } from './parse-ik-solutions'

export interface InspectIKResult {
	/** Raw request JSON, parseable by `parsePlan`. */
	requestContent: string
	seedGroups: IKSeedGroup[]
}

/**
 * Host hook mirroring `ResolvePlanSnapshots`: the plugin has no auth context, org id or RPC client,
 * so the app injects the call. Unlike the FK hook this one must reject rather than return
 * `undefined` on failure — there is no client-side IK to fall back to.
 */
export type ResolveIKSolutions = (planContent: string) => Promise<InspectIKResult>

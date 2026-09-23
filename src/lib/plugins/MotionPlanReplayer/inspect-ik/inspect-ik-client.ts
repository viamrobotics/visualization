import { type IKSeedGroup, parseIKSolutions } from './parse-ik-solutions'

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

/**
 * MOCK — for the standalone dev harness only. Real hosts pass their own `resolveIKSolutions`; this
 * is never reached by accident, since the prop is required.
 *
 * It ignores the plan it is handed and always returns the bundled pirouette pair. That pairing is
 * the point: the request and the solutions describe the same scene, which is what makes the
 * candidate poses drawable at all. An arbitrary uploaded plan would not match the solutions.
 */
// The parameter is the whole point of the real signature, so it stays even though the mock has
// nothing to do with it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const inspectIK: ResolveIKSolutions = async (planContent: string) => {
	// Dynamic so the two fixtures (~116 KB) land in their own chunk instead of the entry bundle.
	const [request, solutions] = await Promise.all([
		import('./fixtures/pirouette-request.json?raw'),
		import('./fixtures/pirouette-solutions.json?raw'),
	])

	// The real call is a network round trip. Without a delay the loading state would never be
	// visible once the chunk is cached, and the mockup is partly about how that reads.
	await new Promise((resolve) => setTimeout(resolve, 500))

	return {
		requestContent: request.default,
		seedGroups: parseIKSolutions(solutions.default),
	}
}

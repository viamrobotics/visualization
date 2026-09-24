/**
 * Options for a resource query whose answer is fixed for the life of the
 * resource, and which nothing renders against: an arm's kinematics, its models.
 * Fetched once and kept.
 *
 * Not for a query something waits on. The retry below keeps the query `pending`
 * for as long as it runs, so anything gating on `isPending` would draw nothing
 * for that whole window.
 */
export const STATIC_RESOURCE_QUERY_OPTIONS = {
	staleTime: Infinity,
	refetchOnMount: false,
	refetchInterval: false as const,
	// The SDK turns retries off for every resource query, which suits a polled one
	// because its next tick is another attempt. Nothing polls these, so a dropped
	// request would leave the arm undrawn until the machine reconnects or rebuilds
	// it. Tanstack's backoff caps at 30s, so six attempts span about a minute,
	// enough to cover a machine restart.
	retry: 6,
}

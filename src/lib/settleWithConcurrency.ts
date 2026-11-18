/**
 * Runs `task` over `items` with at most `limit` in flight, settling each one the
 * way `Promise.allSettled` does. Results keep the order of `items`.
 *
 * A per-request timeout only means something once the request is sent. Starting
 * thousands at once queues them behind each other, and their timers run out together.
 */
export const settleWithConcurrency = async <TItem, TResult>(
	items: readonly TItem[],
	limit: number,
	task: (item: TItem) => Promise<TResult>
): Promise<PromiseSettledResult<TResult>[]> => {
	const results: PromiseSettledResult<TResult>[] = Array.from({ length: items.length })
	let nextIndex = 0

	const work = async () => {
		while (nextIndex < items.length) {
			const index = nextIndex++
			try {
				results[index] = { status: 'fulfilled', value: await task(items[index] as TItem) }
			} catch (error) {
				results[index] = { status: 'rejected', reason: error }
			}
		}
	}

	// At least one, so a zero, negative or NaN limit still settles every item. `Infinity` means no limit.
	const workerCount = Number.isNaN(limit) ? 1 : Math.max(1, limit)
	const workers = Array.from({ length: Math.min(workerCount, items.length) }, work)
	await Promise.all(workers)
	return results
}

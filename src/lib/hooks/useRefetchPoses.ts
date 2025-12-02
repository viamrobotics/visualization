type RefetchFn = () => void

const queries = new Set<{ refetch: RefetchFn }>()

const addQueryToRefetch = (query: { refetch: RefetchFn }) => {
	queries.add(query)
	return () => queries.delete(query)
}

const refetchPoses = () => {
	for (const query of queries) {
		query.refetch()
	}
}

export const useRefetchPoses = () => {
	return {
		addQueryToRefetch,
		refetchPoses,
	}
}

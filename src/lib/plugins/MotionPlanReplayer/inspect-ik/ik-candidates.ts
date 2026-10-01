import {
	classifyIKSolution,
	type IKSeedGroup,
	type IKSolution,
	type IKStatus,
	isScored,
} from './parse-ik-solutions'

export interface IKCandidate {
	/** `seedIndex:indexInSeed` — stable across filter and sort, so rows keep their DOM. */
	id: string
	seed: string
	seedIndex: number
	indexInSeed: number
	status: IKStatus
	solution: IKSolution
}

export type IKStatusCounts = Record<IKStatus, number>

export interface IKSeedBucket {
	seed: string
	seedIndex: number
	candidates: IKCandidate[]
	counts: IKStatusCounts
}

const emptyCounts = (): IKStatusCounts => ({ valid: 0, 'path-invalid': 0, invalid: 0 })

export const toCandidates = (groups: IKSeedGroup[]): IKCandidate[] =>
	groups.flatMap((group, seedIndex) =>
		group.solutions.map((solution, indexInSeed) => ({
			id: `${seedIndex}:${indexInSeed}`,
			seed: group.seed,
			seedIndex,
			indexInSeed,
			status: classifyIKSolution(solution),
			solution,
		}))
	)

export const countByStatus = (candidates: IKCandidate[]): IKStatusCounts => {
	const counts = emptyCounts()
	for (const candidate of candidates) counts[candidate.status] += 1
	return counts
}

export const filterByStatus = (
	candidates: IKCandidate[],
	allowed: ReadonlySet<IKStatus>
): IKCandidate[] => candidates.filter((candidate) => allowed.has(candidate.status))

/** Unscored candidates sort last; a raw -1 would otherwise lead the list. */
export const sortByCost = (candidates: IKCandidate[]): IKCandidate[] =>
	candidates.toSorted((a, b) => {
		const left = a.solution.cost
		const right = b.solution.cost
		if (isScored(left) && isScored(right)) return left - right
		if (isScored(left)) return -1
		if (isScored(right)) return 1
		return 0
	})

export const groupBySeed = (candidates: IKCandidate[]): IKSeedBucket[] => {
	const buckets = new Map<number, IKSeedBucket>()

	for (const candidate of candidates) {
		let bucket = buckets.get(candidate.seedIndex)
		if (!bucket) {
			bucket = {
				seed: candidate.seed,
				seedIndex: candidate.seedIndex,
				candidates: [],
				counts: emptyCounts(),
			}
			buckets.set(candidate.seedIndex, bucket)
		}
		bucket.candidates.push(candidate)
		bucket.counts[candidate.status] += 1
	}

	// Sorting rather than trusting Map insertion order, which follows the (possibly cost-sorted)
	// candidate list rather than the file.
	return [...buckets.values()].toSorted((a, b) => a.seedIndex - b.seedIndex)
}

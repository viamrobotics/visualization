import { BatchedArrow } from '$lib/lib'
import { getContext, setContext } from 'svelte'

const key = Symbol('arrow-context')

export const provideArrows = () => {
	setContext<BatchedArrow>(key, new BatchedArrow())
}

export const useArrows = (): BatchedArrow => {
	return getContext(key)
}

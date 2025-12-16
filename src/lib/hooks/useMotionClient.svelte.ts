import { useResourceNames } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('motion-client-context')

interface Context {
	names: string[]
	current: string | undefined
	set(value?: string | undefined): void
}

export const provideMotionClient = (partID: () => string) => {
	const motionResources = useResourceNames(partID, 'motion')
	const motionNames = $derived(motionResources.current.map((resource) => resource.name))

	let current = $state<string>()

	$effect.pre(() => {
		if (current) {
			return
		}

		if (motionNames.includes('builtin')) {
			current = 'builtin'
			return
		}

		current = motionNames[0]
	})

	setContext<Context>(key, {
		get names() {
			return motionNames
		},
		get current() {
			return current
		},
		set(value) {
			current = value
		},
	})
}

export const useMotionClient = (): Context => {
	return getContext<Context>(key)
}

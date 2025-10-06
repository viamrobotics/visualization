import { getContext, setContext } from 'svelte'

const key = Symbol('weblabs-context')

interface Context {
	weblab: Weblab
}

export const provideWeblabs = () => {
	const weblab = $state(new Weblab())

	setContext<Context>(key, { weblab })
}

export const useWeblabs = () => {
	return getContext<Context>(key)
}

export class Weblab {
	private activeExperiments: Set<string>

	constructor() {
		this.activeExperiments = new Set<string>()
	}

	isActive(experiment: string) {
		return this.activeExperiments.has(experiment)
	}

	load(experiments: string[]) {
		for (const experiment of experiments) {
			if (document.cookie.includes(experiment)) {
				this.activeExperiments.add(experiment)
			}
		}
	}
}

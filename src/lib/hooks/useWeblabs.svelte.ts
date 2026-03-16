import { getContext, setContext } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

export const WEBLABS_EXPERIMENTS = {} as const

export const WEBLABS_CONTEXT_KEY = Symbol('weblabs-context')

const getCookie = (name: string): string | null => {
	const value = `; ${document.cookie}`
	const parts = value.split(`; ${name}=`)
	if (parts.length === 2) {
		return parts.pop()?.split(';').shift() || null
	}
	return null
}

const addCookie = (name: string, value: string, days?: number, path: string = '/'): void => {
	let expires = ''

	if (days !== undefined) {
		const date = new Date()
		date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000) // days in milliseconds
		expires = '; expires=' + date.toUTCString()
	}

	// eslint-disable-next-line unicorn/no-document-cookie
	document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${expires}; path=${path}`
}

const getCookieExperiments = () => {
	const cookie = getCookie('weblab_experiments')
	if (!cookie) {
		return []
	}
	return decodeURIComponent(cookie).split(',')
}

interface Context {
	load: (experiments: string[]) => void
	isActive(experiment: string): boolean
	toggle(experiment: string): void
}

export const createWeblabs = (): Context => {
	const activeExperiments = new SvelteSet<string>()

	const load = (experiments: string[]) => {
		const cookieExperiments = getCookieExperiments()

		for (const experiment of experiments) {
			if (cookieExperiments.includes(experiment)) {
				activeExperiments.add(experiment)
			}
		}
	}

	const toggle = (experiment: string) => {
		const cookieExperiments = new Set(getCookieExperiments())

		if (activeExperiments.has(experiment)) {
			activeExperiments.delete(experiment)
			cookieExperiments.delete(experiment)
		} else {
			activeExperiments.add(experiment)
			cookieExperiments.add(experiment)
		}

		addCookie('weblab_experiments', [...cookieExperiments].join(','))
	}

	return {
		load,
		isActive: (experiment: string) => activeExperiments.has(experiment),
		toggle,
	}
}

export const provideWeblabs = () => {
	const urlExperiment = new URLSearchParams(globalThis.location.search).get('experiment')

	if (urlExperiment) {
		const experimentSet = new Set([...getCookieExperiments(), urlExperiment])
		addCookie('weblab_experiments', [...experimentSet].join(','))
	}

	setContext<Context>(WEBLABS_CONTEXT_KEY, createWeblabs())
}

export const useWeblabs = () => {
	const context = getContext<Context>(WEBLABS_CONTEXT_KEY)
	if (!context) {
		return {
			load: () => {},
			isActive: () => false,
			toggle: () => {},
		}
	}
	return context
}

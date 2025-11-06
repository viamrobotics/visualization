import { getContext, setContext } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

export const WEBLABS_EXPERIMENTS = {
	MOTION_TOOLS_EDIT_FRAME: 'MOTION_TOOLS_EDIT_FRAME',
} as const

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

	return {
		load,
		isActive: (experiment: string) => {
			return activeExperiments.has(experiment)
		},
	}
}

export const provideWeblabs = () => {
	const urlExperiment = new URLSearchParams(window.location.search).get('experiment')

	if (urlExperiment) {
		const experimentSet = new Set([...getCookieExperiments(), urlExperiment])
		addCookie('weblab_experiments', Array.from(experimentSet).join(','))
	}

	setContext<Context>(WEBLABS_CONTEXT_KEY, createWeblabs())
}

export const useWeblabs = () => {
	return getContext<Context>(WEBLABS_CONTEXT_KEY)
}

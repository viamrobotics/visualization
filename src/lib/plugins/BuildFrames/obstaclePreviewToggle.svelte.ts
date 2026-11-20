import { getContext, setContext } from 'svelte'

const key = Symbol('obstacle-preview-toggle')

export interface ObstaclePreviewToggle {
	/** Whether unsaved obstacle shapes are sent to the running machine. Off for every new session. */
	isEnabled: boolean
	/** Why `name` cannot be previewed on the machine right now, or undefined when it can. */
	unavailableReason: (name: string) => string | undefined
}

export const provideObstaclePreviewToggle = (toggle: ObstaclePreviewToggle): void => {
	setContext(key, toggle)
}

export const useObstaclePreviewToggle = (): ObstaclePreviewToggle => getContext(key)

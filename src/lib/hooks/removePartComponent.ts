import type { PartConfig } from './usePartConfig.svelte'

/**
 * Remove the part component named `componentName`, in place. Modules stay, since another component
 * may still load its model from one.
 *
 * @returns Whether the config had a component by that name to remove.
 */
export const removePartComponent = (config: PartConfig, componentName: string): boolean => {
	const components = config.components ?? []
	const remaining = components.filter(({ name }) => name !== componentName)
	if (remaining.length === components.length) return false

	config.components = remaining
	return true
}

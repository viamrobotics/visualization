import type { PartComponent, PartConfig } from './usePartConfig.svelte'

/** The fields of a part component an edit can replace. Each one given is replaced wholesale. */
export type PartComponentPatch = Partial<Pick<PartComponent, 'attributes' | 'visualizer'>>

/**
 * Replace the fields in `patch` on the part component named `componentName`, in place. Fields
 * the patch leaves out are kept. An empty `visualizer` config is removed rather than stored.
 *
 * @returns Whether the config has a component by that name to write to.
 */
export const patchPartComponent = (
	config: PartConfig,
	componentName: string,
	patch: PartComponentPatch
): boolean => {
	const component = config.components?.find(({ name }) => name === componentName)
	if (!component) return false

	if (patch.attributes !== undefined) component.attributes = patch.attributes
	if (patch.visualizer !== undefined) {
		if (Object.keys(patch.visualizer).length === 0) delete component.visualizer
		else component.visualizer = patch.visualizer
	}
	return true
}

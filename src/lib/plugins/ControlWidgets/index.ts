/**
 * Entry point for `<ControlWidgets />`, published as `@viamrobotics/visualization/control-widgets`.
 *
 * Separate from the `/plugins` entry point because this plugin imports `@viamrobotics/test-widgets`,
 * and test-widgets imports this package. Keeping it out of that barrel means importing any other
 * plugin never loads test-widgets.
 */
export { default as ControlWidgets } from './ControlWidgets.svelte'
export { useControlWidgets } from './useControlWidgets.svelte'

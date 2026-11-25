/**
 * Entry point for `<TestWidgets />`, published as `@viamrobotics/visualization/plugins/test-widgets`.
 *
 * Kept out of the `/plugins` barrel because this plugin imports `@viamrobotics/test-widgets`,
 * and test-widgets imports this package. Leaving it out of that barrel means importing any other
 * plugin never loads test-widgets.
 */
export { default as TestWidgets } from './TestWidgets.svelte'
export { useTestWidgets } from './useTestWidgets.svelte'

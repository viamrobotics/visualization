/**
 * Entry point for `<RenderStats />`, published as `@viamrobotics/visualization/render-stats`.
 *
 * Separate from the `/plugins` entry point because this plugin imports `svelte-tweakpane-ui` for
 * its graphs and monitors. Keeping it out of that barrel means importing any other plugin never
 * loads tweakpane.
 */
export { default as RenderStats } from './RenderStats.svelte'

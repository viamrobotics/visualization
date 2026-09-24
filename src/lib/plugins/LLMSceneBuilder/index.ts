/**
 * Server-safe entry point for `<LLMSceneBuilder />`: the system prompt and wire schemas its
 * `onInfer` callback is built around, published as `@viamrobotics/visualization/scene-builder`.
 *
 * Separate from the `/plugins` entry point on purpose. That barrel pulls in every plugin's Svelte
 * components, which a Node or edge handler cannot import. Nothing reachable from here touches
 * Svelte, three.js, or the DOM, so it is safe to import from an API route — keep it that way when
 * adding exports.
 *
 * The plugin does not use any of this at runtime; it is a reference implementation of the
 * contract, so bringing your own model means changing the call, not rebuilding the prompt.
 *
 * The `.js` extensions are load-bearing: svelte-package emits relative specifiers verbatim, and
 * Node's ESM resolver will not fill in an extension. Without them a Node API route fails at import.
 */

export {
	ComponentFrameInfoSchema,
	FrameDeltaSchema,
	type SceneBuilderRequest,
	SceneBuilderRequestSchema,
	type SceneBuilderResponse,
	SceneBuilderResponseSchema,
} from './inferContract.js'
export { SCENE_BUILDER_SYSTEM_PROMPT, sceneBuilderSystemMessage } from './systemPrompt.js'

import { z } from 'zod'

/**
 * Wire schemas for the request `<LLMSceneBuilder />`'s `onInfer` callback makes and the response
 * it expects back.
 *
 * These are deliberately independent of the plugin's own `ComponentFrameInfo` / `FrameDelta`
 * types: those live behind Svelte and three.js imports, and this module has to stay importable
 * from a Node or edge handler. `inferContract.spec.ts` asserts the two stay structurally
 * compatible, so a change on either side fails there rather than at a consumer's runtime.
 *
 * All distances are millimeters and all angles are Euler degrees, matching
 * {@link SCENE_BUILDER_SYSTEM_PROMPT}.
 */

const GeometryTypeSchema = z.enum(['none', 'box', 'sphere', 'capsule'])

/** A component's current frame, as sent to the model for context. */
export const ComponentFrameInfoSchema = z.object({
	name: z.string(),
	frame: z.object({
		parent: z.string(),
		translation: z.object({ x: z.number(), y: z.number(), z: z.number() }),
		orientation: z.object({ roll: z.number(), pitch: z.number(), yaw: z.number() }),
		geometry: z
			.object({
				type: GeometryTypeSchema,
				x: z.number().optional(),
				y: z.number().optional(),
				z: z.number().optional(),
				r: z.number().optional(),
				l: z.number().optional(),
			})
			.optional()
			.describe(
				"the component's current collision geometry, if any. Absent means the component has no geometry yet."
			),
	}),
})

/** The body `onInfer` should send to your handler. */
export const SceneBuilderRequestSchema = z.object({
	prompt: z.string().min(1),
	components: z.array(ComponentFrameInfoSchema),
})

/** One proposed change. Only the fields being changed are present. */
export const FrameDeltaSchema = z.object({
	componentName: z
		.string()
		.describe('the exact component name from the provided context that needs updating'),
	translation: z
		.object({
			x: z.number().optional(),
			y: z.number().optional(),
			z: z.number().optional(),
		})
		.optional(),
	orientation: z
		.object({
			roll: z.number().min(-180).max(180).optional(),
			pitch: z.number().min(-180).max(180).optional(),
			yaw: z.number().min(-180).max(180).optional(),
		})
		.optional(),
	geometry: z
		.object({
			type: GeometryTypeSchema.optional(),
			x: z.number().positive().optional(),
			y: z.number().positive().optional(),
			z: z.number().positive().optional(),
			r: z.number().positive().optional(),
			l: z.number().positive().optional(),
		})
		.optional()
		.describe(
			'geometry change. Omit "type" to resize the current shape (send only changed dims); set "type" to change shape and send that type\'s dims (box → x/y/z, sphere → r, capsule → r/l); set "type" to "none" to REMOVE the geometry. All dims in millimeters. Omit this field entirely to leave geometry unchanged — never send null.'
		),
	parent: z.string().optional(),
	explanation: z
		.string()
		.optional()
		.describe(
			'brief phrase explaining what this specific change does — omit for simple single-field changes'
		),
})

/**
 * What your handler must return. Pass this straight to a structured-output call: the field
 * descriptions are written to be read by the model.
 */
export const SceneBuilderResponseSchema = z.object({
	updates: z
		.array(FrameDeltaSchema)
		.describe(
			'One entry per component that needs to change. If a component needs both translation and orientation changes, put ALL of them in the same entry — never create two entries with the same componentName. Empty only if truly nothing needs to change.'
		),
	explanation: z
		.string()
		.optional()
		.describe(
			'One sentence summarizing the changes made, e.g. "Rotated arm-1 yaw to 90°." Omit when refusing.'
		),
	refusal: z
		.string()
		.optional()
		.describe(
			'Set only when the request cannot be fulfilled (e.g. adding or removing a whole component). When set, "updates" must be empty.'
		),
})

export type SceneBuilderRequest = z.infer<typeof SceneBuilderRequestSchema>
export type SceneBuilderResponse = z.infer<typeof SceneBuilderResponseSchema>

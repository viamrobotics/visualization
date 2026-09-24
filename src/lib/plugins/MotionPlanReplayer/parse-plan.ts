import { z } from 'zod'

/**
 * Duplicates `frameDescriptors.ts`'s `RawFrame` rather than importing it: this file decodes
 * untrusted JSON, that one reads a trusted shape. Narrow this and `buildFrameDescriptors` stops
 * compiling.
 */
const RawFrameSchema = z.object({
	frame_type: z.string(),
	frame: z.unknown(),
})

const FrameSystemSchema = z.object({
	frames: z.record(z.string(), RawFrameSchema),
	parents: z.record(z.string(), z.string()),
})

/**
 * Go `referenceframe.GeometriesInFrame`, which is not a proto, so no language generates a decoder
 * for it and the wrapper is checked here. Its geometries stay opaque for `parseGeometry`, which
 * already reads that same `GeometryConfig` encoding off `frame_system` frames.
 */
const ObstaclesInWorldFrameSchema = z.object({
	frame: z
		.string()
		.optional()
		.transform((frame) => frame || 'world'),
	geometries: z.array(z.unknown()).default([]),
})

const PlanChunkSchema = z.object({
	frame_system: FrameSystemSchema.optional(),
	goals: z.array(z.unknown()).optional(),
	trajectory: z.array(z.record(z.string(), z.array(z.number()))).optional(),
	// Opaque by contrast: protobuf-es decodes this one, so zod here would re-copy a proto shape.
	world_state: z.unknown().optional(),
	obstacles_in_world_frame: ObstaclesInWorldFrameSchema.optional(),
})

export type ObstaclesInWorldFrame = z.infer<typeof ObstaclesInWorldFrameSchema>

type RawFrame = z.infer<typeof RawFrameSchema>

export class PlanParseError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'PlanParseError'
	}
}

const skipWhitespace = (text: string, start: number): number => {
	let i = start
	while (i < text.length && /\s/.test(text[i]!)) i++
	return i
}

const readJSONObject = (text: string, start: number): { raw: string; end: number } | null => {
	let i = skipWhitespace(text, start)
	if (i >= text.length || text[i] !== '{') return null
	let depth = 0
	let inString = false
	let escaped = false
	for (; i < text.length; i++) {
		const ch = text[i]!
		if (inString) {
			if (escaped) {
				escaped = false
				continue
			}
			if (ch === '\\') {
				escaped = true
				continue
			}
			if (ch === '"') inString = false
			continue
		}
		if (ch === '"') {
			inString = true
			continue
		}
		if (ch === '{') {
			depth++
			continue
		}
		if (ch === '}') {
			depth--
			if (depth === 0) return { raw: text.slice(start, i + 1), end: i + 1 }
		}
	}
	return null
}

const splitJsonObjects = (content: string): string[] => {
	const chunks: string[] = []
	let index = 0
	for (let i = 0; i < 8; i++) {
		index = skipWhitespace(content, index)
		if (index >= content.length) break
		const next = readJSONObject(content, index)
		if (!next) break
		chunks.push(next.raw)
		index = next.end
	}
	return chunks
}

const PlanSchema = z
	.string()
	// A plan file is one or more JSON objects concatenated with no separator, so
	// split it before anything can be handed to JSON.parse.
	.transform(splitJsonObjects)
	.pipe(z.array(z.string()).min(1, 'plan JSON contains invalid JSON'))
	.transform((chunks, ctx) => {
		try {
			return chunks.map((raw) => JSON.parse(raw) as unknown)
		} catch {
			ctx.addIssue({ code: 'custom', message: 'plan JSON contains invalid JSON' })
			return z.NEVER
		}
	})
	.pipe(z.array(PlanChunkSchema))
	.transform((chunks, ctx) => {
		let frames: Record<string, RawFrame> = {}
		let parents: Record<string, string> = {}
		let trajectory: Array<Record<string, number[]>> = []
		let goals: unknown[] = []
		let worldState: unknown
		let obstaclesInWorldFrame: ObstaclesInWorldFrame | undefined
		let foundFrameSystem = false

		for (const chunk of chunks) {
			if (chunk.frame_system) {
				frames = chunk.frame_system.frames
				parents = chunk.frame_system.parents
				goals = chunk.goals ?? []
				// Kept apart rather than merged: which key a payload came from decides how it decodes,
				// and no capture writes both, so neither needs to win.
				worldState = chunk.world_state
				obstaclesInWorldFrame = chunk.obstacles_in_world_frame
				foundFrameSystem = true
			}

			if (chunk.trajectory) {
				trajectory = chunk.trajectory
			}
		}

		if (!foundFrameSystem) {
			ctx.addIssue({ code: 'custom', message: 'plan is missing frame_system' })
			return z.NEVER
		}

		return { frames, parents, trajectory, goals, worldState, obstaclesInWorldFrame }
	})

export type ParsedPlan = z.infer<typeof PlanSchema>

/**
 * Parses RDK's JSON plan output into a `ParsedPlan`, reconstructing the frame system from that
 * JSON rather than sharing code with RDK. Runs only when the host's `resolvePlanSnapshots`
 * returns `undefined`, so coverage is partial by construction and falls behind as RDK gains
 * frame, orientation, and geometry types.
 *
 * @throws `PlanParseError` when the content does not match the expected shape.
 */
export const parsePlan = (content: string): ParsedPlan => {
	const result = PlanSchema.safeParse(content)
	if (result.success) return result.data

	const issue = result.error.issues[0]
	const path = issue?.path.join('.')
	throw new PlanParseError(
		path ? `${issue!.message} (at ${path})` : (issue?.message ?? 'plan JSON is invalid')
	)
}

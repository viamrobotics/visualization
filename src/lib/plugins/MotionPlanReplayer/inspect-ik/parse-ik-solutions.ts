import { z } from 'zod'

/** Traffic-light class: `valid` is green, `path-invalid` yellow, `invalid` red. */
export type IKStatus = 'valid' | 'path-invalid' | 'invalid'

/**
 * A seed the solver returned nothing for reports `cost: -1` with a null configuration and no
 * error, rather than being omitted. The sentinel has to survive parsing: rendered literally it
 * would lead every cost-sorted list with a value that isn't a cost.
 */
export const UNSCORED_COST = -1

export const isScored = (cost: number): boolean => cost !== UNSCORED_COST

/** No configuration means there is nothing to draw — distinct from a configuration that collides. */
export const hasSolution = (solution: Pick<IKSolution, 'configuration'>): boolean =>
	solution.configuration !== null

const SolutionSchema = z
	.object({
		cost: z.number(),
		configuration: z.record(z.string(), z.array(z.number())).nullable(),
		configuration_valid: z.boolean(),
		checkpath_valid: z.boolean().optional(),
		error: z.string().optional(),
		first_error: z.string().optional(),
		last_good_inputs: z.record(z.string(), z.array(z.number())).optional(),
	})
	.transform((solution) => ({
		cost: solution.cost,
		configuration: solution.configuration,
		configurationValid: solution.configuration_valid,
		// Absent means the path check never ran, which only happens when the configuration was
		// already rejected — the same outcome as an explicit false.
		checkpathValid: solution.checkpath_valid ?? false,
		error: solution.error,
		firstError: solution.first_error,
		lastGoodInputs: solution.last_good_inputs,
	}))

export type IKSolution = z.infer<typeof SolutionSchema>

const SeedGroupSchema = z.object({
	seed: z.string(),
	solutions: z.array(SolutionSchema),
})

export type IKSeedGroup = z.infer<typeof SeedGroupSchema>

export class IKSolutionsParseError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'IKSolutionsParseError'
	}
}

export const IK_STATUS_LABEL: Record<IKStatus, string> = {
	valid: 'Valid',
	'path-invalid': 'Path blocked',
	invalid: 'Goal blocked',
}

/** Legend-length. The full reasoning lives in the MotionPlanFailure Debugging guide. */
export const IK_STATUS_DESCRIPTION: Record<IKStatus, string> = {
	valid: 'End pose and the direct joint-space path are both clear.',
	'path-invalid': 'End pose is reachable, but interpolating straight to it collides.',
	invalid: 'The end pose itself collides — the goal is the problem, not the route.',
}

export const classifyIKSolution = (solution: {
	configurationValid: boolean
	checkpathValid: boolean
}): IKStatus => {
	if (!solution.configurationValid) return 'invalid'
	return solution.checkpathValid ? 'valid' : 'path-invalid'
}

const IKSolutionsSchema = z
	.string()
	.transform((content, ctx) => {
		try {
			return JSON.parse(content) as unknown
		} catch {
			ctx.addIssue({ code: 'custom', message: 'IK solutions contain invalid JSON' })
			return z.NEVER
		}
	})
	.pipe(z.array(SeedGroupSchema).min(1, 'IK solutions contain no seed groups'))

export const parseIKSolutions = (content: string): IKSeedGroup[] => {
	const result = IKSolutionsSchema.safeParse(content)
	if (result.success) return result.data

	const issue = result.error.issues[0]
	const path = issue?.path.join('.')
	throw new IKSolutionsParseError(
		path ? `${issue!.message} (at ${path})` : (issue?.message ?? 'IK solutions are invalid')
	)
}

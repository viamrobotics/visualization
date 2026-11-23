import type * as SvelteSdk from '@viamrobotics/svelte-sdk'

type AnyQueryCreator = (...args: unknown[]) => unknown

/** The part ID each robot query was created for, in creation order. */
export const robotQueryParts: string[] = []

/**
 * The svelte-sdk with its four robot query creators wrapped to record the part each query
 * addresses in `robotQueryParts`. Every robot RPC the scene makes starts at one of them.
 */
export const recordRobotQueryParts = (sdk: typeof SvelteSdk): typeof SvelteSdk => ({
	...sdk,
	createRobotQuery: ((client: { partID: string }, ...rest: unknown[]) => {
		robotQueryParts.push(client.partID)
		return (sdk.createRobotQuery as AnyQueryCreator)(client, ...rest)
	}) as typeof sdk.createRobotQuery,
	createResourceQuery: ((client: { partID: string }, ...rest: unknown[]) => {
		robotQueryParts.push(client.partID)
		return (sdk.createResourceQuery as AnyQueryCreator)(client, ...rest)
	}) as typeof sdk.createResourceQuery,
	useMachineStatus: (partID, ...rest) => {
		robotQueryParts.push(partID())
		return sdk.useMachineStatus(partID, ...rest)
	},
	useResourceStatuses: (partID, ...rest) => {
		robotQueryParts.push(partID())
		return sdk.useResourceStatuses(partID, ...rest)
	},
})

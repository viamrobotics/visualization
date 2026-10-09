import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'

import { MotionPlanService } from '#lib/buf/motionplan/v1/motionplan_connect.js'
import { ikSeedGroupsFromProto, type ResolveIKSolutions } from '#lib/plugins/index.js'

/**
 * Runs IK inspection on the local draw server, which hosts `MotionPlanService` beside the draw
 * service. Errors propagate so `useIKInspection` can show them, since there is no fallback IK.
 *
 * @param getBaseUrl Read per call, because the replayer captures the resolver once at mount
 *   while the `drawPort` override can change afterwards.
 */
export const createIKSolutionsResolver = (getBaseUrl: () => string): ResolveIKSolutions => {
	return async (planContent) => {
		const client = createClient(
			MotionPlanService,
			createConnectTransport({ baseUrl: getBaseUrl() })
		)
		const response = await client.getIKSolutions({
			planContent: new TextEncoder().encode(planContent),
		})
		return { requestContent: planContent, seedGroups: ikSeedGroupsFromProto(response) }
	}
}

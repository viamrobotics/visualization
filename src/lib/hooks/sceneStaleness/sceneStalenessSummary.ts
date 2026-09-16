import type { SceneFreshness, SceneStalenessReason } from './sceneStalenessReason'

const installingSummary = ({ installing }: SceneFreshness): string => {
	const [first] = installing

	return installing.length === 1 && first
		? `installing ${first.name}`
		: `installing ${installing.length} modules`
}

const reconfiguringSummary = ({ reconfiguring }: SceneFreshness): string => {
	const [first] = reconfiguring

	return reconfiguring.length === 1 && first
		? `${first.name} is ${first.state}`
		: `${reconfiguring.length} resources are configuring`
}

/**
 * One line naming what the scene is waiting on. Leads with the fact that it is
 * updating, since the confusion this answers is not knowing whether the scene
 * will catch up on its own.
 */
export const sceneStalenessSummary = (
	reason: SceneStalenessReason,
	freshness: SceneFreshness
): string => {
	switch (reason) {
		case 'installing': {
			return `Updating the scene: ${installingSummary(freshness)}`
		}
		case 'reconfiguring': {
			return `Updating the scene: ${reconfiguringSummary(freshness)}`
		}
		case 'starting': {
			return 'Updating the scene: the machine is still starting up'
		}
		case 'awaiting-config': {
			return 'Updating the scene: the machine has not picked up the saved configuration yet'
		}
		case 'scene-behind': {
			return 'Updating the scene: the machine was reconfigured'
		}
		default: {
			const unhandled: never = reason
			return unhandled
		}
	}
}

import type { SceneFreshness, SceneStalenessReason } from './sceneStalenessReason'

export interface SceneStalenessMessage {
	/**
	 * Badge text. One word, sharing a 240px header with the panel title, and a
	 * present participle: the badge renders a spinner, so a label naming a state
	 * rather than an action reads as a contradiction of the motion beside it.
	 */
	label: string

	/** One line naming what is happening, with the resource or module in it. */
	summary: string
}

const installingSummary = ({ installing }: SceneFreshness): string => {
	const [first] = installing

	return installing.length === 1 && first
		? `Installing ${first.name}`
		: `Installing ${installing.length} modules`
}

const reconfiguringSummary = ({ reconfiguring }: SceneFreshness): string => {
	const [first] = reconfiguring

	return reconfiguring.length === 1 && first
		? `${first.name} is ${first.state}`
		: `${reconfiguring.length} resources are configuring`
}

/**
 * How a staleness reason reads in the badge.
 *
 * Each reason gets its own wording rather than sharing one "Updating" label,
 * because the reasons are not the same event. Four of them are the machine
 * working through a config the user saved, and the scene may already be drawing
 * that config in build mode. Only `scene-behind` is the scene itself catching
 * up, so only it may say so.
 */
export const sceneStalenessMessage = (
	reason: SceneStalenessReason,
	freshness: SceneFreshness
): SceneStalenessMessage => {
	switch (reason) {
		case 'installing': {
			return {
				label: 'Installing',
				summary: installingSummary(freshness),
			}
		}
		case 'reconfiguring': {
			return {
				label: 'Configuring',
				summary: reconfiguringSummary(freshness),
			}
		}
		case 'starting': {
			return {
				label: 'Starting',
				summary: 'The machine is still starting up',
			}
		}
		case 'awaiting-config': {
			return {
				label: 'Applying',
				summary: 'Waiting for the machine to pick up the saved configuration',
			}
		}
		case 'scene-behind': {
			return {
				label: 'Updating',
				summary: "Redrawing from the machine's new configuration",
			}
		}
		default: {
			const unhandled: never = reason
			return unhandled
		}
	}
}

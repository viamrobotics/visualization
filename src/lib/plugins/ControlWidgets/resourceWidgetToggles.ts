import type { ResourceName } from '@viamrobotics/sdk'

import {
	getResourceAPI,
	ResourceDoCommandWidget,
	ResourceTriplets,
	showResourceWidget,
	supportsDoCommand,
} from '@viamrobotics/test-widgets'
import {
	apiWidgetsForResource,
	type ResourceAPIWidget,
	widgetForResource,
} from '@viamrobotics/test-widgets/registry'

/**
 * Reserved widget id for a resource's composite "card" widget. Used as the
 * {@link ResourceAPIWidget.id} for the fallback toggle shown when a resource has
 * no per-API widgets.
 */
export const CARD_WIDGET_ID = '__resource_card__'

/** Widget id for the motion service's Move control. */
export const MOTION_MOVE_WIDGET_ID = 'move'

/**
 * Widget id for a resource's generic DoCommand control. Offered for every
 * DoCommand-capable resource we surface (see {@link resourceWidgetToggles}).
 */
export const DO_COMMAND_WIDGET_ID = 'do-command'

/**
 * The registry (`showResourceWidget`) hides the built-in motion service to match the
 * Viam app's control page, which omits it so users aren't confused by a control for a
 * service they never added to their config. In these tools the motion service is a
 * first-class control, so we surface it despite that filter.
 */
const isMotionService = (resource: ResourceName): boolean =>
	getResourceAPI(resource) === ResourceTriplets.Motion

/**
 * The widget toggles to offer for a resource:
 *
 *  - A resource with per-API widgets shows those.
 *  - The motion service surfaces its Move control. The registry lists no per-API
 *    widgets for motion, but its card is the frame-aware Move widget the MoveFrame
 *    plugin also uses, so we offer it here as a "Move" option (see {@link isMotionService}).
 *  - Any other resource falls back to a single composite card toggle when the registry
 *    says to surface one.
 *  - Every DoCommand-capable resource we surface also gets a generic DoCommand control,
 *    appended last. For generic components/services (which have no card) this is the only
 *    toggle, matching the Viam app control page. It stays hidden for resources the registry
 *    hides (data manager, sensors service, shell, internal) and for ML Model.
 *  - Anything unwidgetable returns `[]` and is hidden from the list.
 */
export const resourceWidgetToggles = (resource: ResourceName): ResourceAPIWidget[] => {
	const toggles: ResourceAPIWidget[] = []

	const apis = apiWidgetsForResource(resource)
	if (apis.length > 0) {
		toggles.push(...apis)
	} else {
		const card = widgetForResource(resource)
		if (card) {
			if (isMotionService(resource)) {
				toggles.push({ id: MOTION_MOVE_WIDGET_ID, label: 'Move', widgets: [card] })
			} else if (showResourceWidget(resource)) {
				toggles.push({ id: CARD_WIDGET_ID, label: 'Overview', widgets: [card] })
			}
		}
	}

	if (supportsDoCommand(resource) && (showResourceWidget(resource) || isMotionService(resource))) {
		toggles.push({
			id: DO_COMMAND_WIDGET_ID,
			label: 'DoCommand',
			widgets: [ResourceDoCommandWidget],
		})
	}

	return toggles
}

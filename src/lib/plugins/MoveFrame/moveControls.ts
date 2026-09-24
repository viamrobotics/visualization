import type { ResourceName } from '@viamrobotics/sdk'

/** The motion service names on the machine, in discovery order. */
export const motionServiceNames = (resources: ResourceName[]): string[] =>
	resources
		.filter((resource) => resource.type === 'service' && resource.subtype === 'motion')
		.map((resource) => resource.name)

/**
 * The motion service to select by default: the built-in service when present,
 * otherwise the first available, or `''` when the machine has none.
 */
export const defaultMotionService = (services: string[]): string =>
	services.find((name) => name === 'builtin') ?? services[0] ?? ''

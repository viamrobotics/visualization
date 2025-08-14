import { ResourceName } from '@viamrobotics/sdk'

export const createResourceId = (resource: ResourceName) => {
	return `${resource.namespace}:${resource.type}:${resource.subtype}/${resource.name}`
}

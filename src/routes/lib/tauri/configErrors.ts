import { LAUNCH_CONFIG_VERSION } from './configVersion'

export class LaunchConfigError extends Error {
	constructor() {
		super('Launch file is not an object')
		this.name = 'LaunchConfigError'
	}
}

export class LaunchConfigVersionError extends Error {
	constructor(version: unknown) {
		super(
			`Launch file version ${String(version)} is not supported, expected ${LAUNCH_CONFIG_VERSION}`
		)
		this.name = 'LaunchConfigVersionError'
	}
}

export class LaunchConfigFieldError extends Error {
	constructor(field: string) {
		super(`Launch file field "${field}" is missing`)
		this.name = 'LaunchConfigFieldError'
	}
}

export class LaunchConfigExpiryError extends Error {
	constructor() {
		super('Launch file field "expiresAt" must be a string')
		this.name = 'LaunchConfigExpiryError'
	}
}

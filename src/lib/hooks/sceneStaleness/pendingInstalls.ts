import { robotApi } from '@viamrobotics/sdk'

/**
 * `viam.app.packages.v1.PackageType.PACKAGE_TYPE_MODULE`. The generated enum is
 * not re-exported by `@viamrobotics/sdk`, so the value is named here rather than
 * deep-imported from its build output. Proto enum values are wire-stable.
 */
const PACKAGE_TYPE_MODULE = 3

/** Something the machine has to finish installing before its resources can configure. */
export interface PendingInstall {
	name: string
	state: 'downloading' | 'loading' | 'first run' | 'pending' | 'starting' | 'closing'

	/** Bytes fetched so far. Zero for a module, which reports no size. */
	bytesDownloaded: number

	/** Total size in bytes, or zero when the machine does not know it yet. */
	totalBytes: number
}

const moduleStateLabel = (
	state: robotApi.ModuleStatus_State
): PendingInstall['state'] | undefined => {
	switch (state) {
		case robotApi.ModuleStatus_State.PENDING: {
			return 'pending'
		}
		case robotApi.ModuleStatus_State.STARTING: {
			return 'starting'
		}
		case robotApi.ModuleStatus_State.CLOSING: {
			return 'closing'
		}
		default: {
			return undefined
		}
	}
}

const packageStateLabel = (
	state: robotApi.PackageStatus_State
): PendingInstall['state'] | undefined => {
	switch (state) {
		case robotApi.PackageStatus_State.DOWNLOADING: {
			return 'downloading'
		}
		case robotApi.PackageStatus_State.LOADING: {
			return 'loading'
		}
		case robotApi.PackageStatus_State.FIRST_RUN: {
			return 'first run'
		}
		default: {
			return undefined
		}
	}
}

/**
 * Modules the machine is still installing, one entry per name.
 *
 * Packages are restricted to `MODULE`. An `ml_model` or `slam_map` download
 * delays whatever consumes it, not the models a resource is built from, and
 * counting one would have the badge report installing modules that are not
 * modules.
 *
 * A module's package is reported under both messages while it downloads, and
 * counting that as two waits would overstate what is happening. The package
 * entry wins the collision: fetching the tarball is the long half of the wait
 * and the only half that reports progress. The collapse is best-effort, since
 * `PackageStatus.name` is the name the robot config gave the package while
 * `ModuleStatus.moduleName` is the module's own. Where the two differ the module
 * and its package are reported separately, which overstates the count but names
 * both truthfully.
 *
 * `closing` counts as pending because a reconfigure restarts a module through
 * it, so the models it registers are unavailable until it comes back.
 */
export const pendingInstalls = (
	modules: robotApi.ModuleStatus[] = [],
	packages: robotApi.PackageStatus[] = []
): PendingInstall[] => {
	const byName = new Map<string, PendingInstall>()

	for (const { moduleName, state } of modules) {
		const label = moduleStateLabel(state)
		if (label === undefined) continue

		byName.set(moduleName, {
			name: moduleName,
			state: label,
			bytesDownloaded: 0,
			totalBytes: 0,
		})
	}

	for (const { name, type: packageType, state, bytesDownloaded, totalBytes } of packages) {
		if (packageType !== PACKAGE_TYPE_MODULE) continue

		const label = packageStateLabel(state)
		if (label === undefined) continue

		byName.set(name, {
			name,
			state: label,
			bytesDownloaded: Number(bytesDownloaded),
			totalBytes: Number(totalBytes),
		})
	}

	return [...byName.values()]
}

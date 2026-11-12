/**
 * What a second launch hands the running instance through `app.requestSingleInstanceLock`. The
 * second instance resolves its own launch file against its own working directory, so the running
 * instance never parses another process's argv, which Electron may pass with Chromium switches
 * added, or without arguments at all when another user launched it.
 */
export interface SecondInstanceData {
	launchFile?: string
}

/** The launch file a second instance resolved. The data crosses a process boundary, so it is checked. */
export const launchFileFromSecondInstance = (data: unknown): string | undefined =>
	typeof data === 'object' &&
	data !== null &&
	'launchFile' in data &&
	typeof data.launchFile === 'string'
		? data.launchFile
		: undefined

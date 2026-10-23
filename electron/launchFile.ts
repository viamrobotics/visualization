import { readFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

import type { LaunchConfigPayload } from '../src/routes/lib/desktop/launchConfig'

const LAUNCH_FILE_FLAG = '--launch-file'
const SUPPORTED_VERSION = 1

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const failure = (error: string): LaunchConfigPayload => {
	console.error(error)
	return { config: null, error }
}

/** The path given as `--launch-file <path>` or `--launch-file=<path>`, as written. */
export const findLaunchFile = (argv: readonly string[]): string | undefined => {
	const inlinePrefix = `${LAUNCH_FILE_FLAG}=`
	for (const [index, argument] of argv.entries()) {
		if (argument === LAUNCH_FILE_FLAG) return argv[index + 1]
		if (argument.startsWith(inlinePrefix)) return argument.slice(inlinePrefix.length)
	}
	return undefined
}

/**
 * The absolute launch file path named in `argv`. A relative path resolves against `cwd`, the
 * directory the launch ran from.
 */
export const resolveLaunchFile = (argv: readonly string[], cwd: string): string | undefined => {
	const launchFile = findLaunchFile(argv)
	return launchFile === undefined ? undefined : path.resolve(cwd, launchFile)
}

/**
 * Reads and parses the launch file at `file`. Deletes it once it parses as a JSON object with a
 * `version` key, supported or not, so the token does not outlive the read. Anything else stays on
 * disk, since the path may name a file that was never a launch file. Errors name the path, never
 * the contents, and are also written to stderr.
 */
export const readLaunchFile = (file: string): LaunchConfigPayload => {
	let contents: string
	try {
		contents = readFileSync(file, 'utf8')
	} catch (error) {
		return failure(`Cannot read launch file ${file}: ${(error as Error).message}`)
	}

	let value: unknown
	try {
		value = JSON.parse(contents)
	} catch {
		return failure(`Cannot parse launch file ${file} as JSON`)
	}

	if (!isRecord(value) || !('version' in value)) {
		return failure(`${file} is not a launch file, it has no version`)
	}

	try {
		unlinkSync(file)
	} catch (error) {
		console.error(`Could not remove launch file ${file}: ${(error as Error).message}`)
	}

	const { version } = value
	if (!Number.isInteger(version) || (version as number) < 0) {
		return failure(`Launch file ${file} has no integer version, expected ${SUPPORTED_VERSION}`)
	}
	if (version !== SUPPORTED_VERSION) {
		return failure(
			`Launch file ${file} version ${String(version)} is not supported, expected ${SUPPORTED_VERSION}`
		)
	}
	return { config: value, error: null }
}

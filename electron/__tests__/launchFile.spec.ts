import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { findLaunchFile, readLaunchFile, resolveLaunchFile } from '../launchFile'

let directory: string

const writeLaunchFile = (contents: string, name = 'launch.json') => {
	const file = path.join(directory, name)
	writeFileSync(file, contents)
	return file
}

beforeEach(() => {
	directory = mkdtempSync(path.join(tmpdir(), 'launch-file-'))
	vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
	rmSync(directory, { force: true, recursive: true })
})

describe('findLaunchFile', () => {
	it('reads the value after a separate flag', () => {
		expect(findLaunchFile(['app', '--launch-file', '/tmp/a.json'])).toBe('/tmp/a.json')
	})

	it('reads the value of an equals flag', () => {
		expect(findLaunchFile(['app', '--launch-file=/tmp/b.json'])).toBe('/tmp/b.json')
	})

	it('finds the flag among the switches Chromium adds', () => {
		expect(
			findLaunchFile(['app', '--original-process-start-time=1', '--launch-file=/tmp/c.json'])
		).toBe('/tmp/c.json')
	})

	it('returns undefined for a flag with no value', () => {
		expect(findLaunchFile(['app', '--launch-file'])).toBeUndefined()
	})

	it('returns undefined without the flag', () => {
		expect(findLaunchFile(['app'])).toBeUndefined()
	})
})

describe('resolveLaunchFile', () => {
	it('resolves a relative path against the launching directory', () => {
		expect(resolveLaunchFile(['app', '--launch-file', 'launch.json'], '/home/me')).toBe(
			path.resolve('/home/me', 'launch.json')
		)
	})

	it('keeps an absolute path as is', () => {
		expect(resolveLaunchFile(['app', '--launch-file', '/tmp/a.json'], '/does-not-exist')).toBe(
			path.resolve('/tmp/a.json')
		)
	})
})

describe('readLaunchFile', () => {
	it('returns a version 1 file and deletes it', () => {
		const file = writeLaunchFile('{"version":1,"host":"h"}')

		expect(readLaunchFile(file)).toEqual({ config: { version: 1, host: 'h' }, error: null })
		expect(existsSync(file)).toBe(false)
	})

	it('names the path and version for an unsupported version, and deletes the file', () => {
		const file = writeLaunchFile('{"version":2}')

		const { error } = readLaunchFile(file)

		expect(error).toBe(`Launch file ${file} version 2 is not supported, expected 1`)
		expect(existsSync(file)).toBe(false)
	})

	it('rejects a non-integer version and deletes the file', () => {
		const file = writeLaunchFile('{"version":"1"}')

		expect(readLaunchFile(file).error).toBe(
			`Launch file ${file} has no integer version, expected 1`
		)
		expect(existsSync(file)).toBe(false)
	})

	it('rejects invalid JSON and keeps the file', () => {
		const file = writeLaunchFile('not json')

		expect(readLaunchFile(file).error).toBe(`Cannot parse launch file ${file} as JSON`)
		expect(existsSync(file)).toBe(true)
	})

	it('rejects JSON without a version and keeps the file', () => {
		const file = writeLaunchFile('{"host":"h"}')

		expect(readLaunchFile(file).error).toBe(`${file} is not a launch file, it has no version`)
		expect(existsSync(file)).toBe(true)
	})

	it('rejects a JSON array and keeps the file', () => {
		const file = writeLaunchFile('[{"version":1}]')

		expect(readLaunchFile(file).error).toBe(`${file} is not a launch file, it has no version`)
		expect(existsSync(file)).toBe(true)
	})

	it('names the path of a missing file', () => {
		const file = path.join(directory, 'does-not-exist.json')

		expect(readLaunchFile(file).error).toContain(`Cannot read launch file ${file}`)
	})

	it('never puts the file contents in the error', () => {
		const file = writeLaunchFile('{"version":2,"credentials":{"payload":"secret-token"}}')

		expect(readLaunchFile(file).error).not.toContain('secret-token')
	})
})

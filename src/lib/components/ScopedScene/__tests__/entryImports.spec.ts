import { describe, expect, it } from 'vitest'

/** Every source file under `src/lib` outside the specs, keyed by its path from the repo root. */
const librarySources = import.meta.glob<string>(
	['/src/lib/**/*.{ts,svelte}', '!/src/lib/**/__tests__/**', '!/src/lib/buf/**'],
	{ query: '?raw', import: 'default', eager: true }
)

const ENTRY = '/src/lib/scoped-scene.ts'
const PLUGINS_ROOT = '/src/lib/plugins/'

/** A static `import` or `export … from`, with the `type` keyword captured when the whole statement is type-only. */
const STATIC_IMPORT = /^\s*(?:import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm

const RESOLVED_SUFFIXES = ['', '.ts', '.svelte.ts', '/index.ts']

const directoryOf = (file: string) => file.slice(0, file.lastIndexOf('/'))

/** Collapses `.` and `..` segments, since `import.meta.glob` keys are already normalized. */
const normalize = (path: string) => {
	const segments: string[] = []
	for (const segment of path.split('/')) {
		if (segment === '..') segments.pop()
		else if (segment !== '.') segments.push(segment)
	}
	return segments.join('/')
}

/** The source file a specifier names, or `undefined` for a package or a file outside the map. */
const resolveImport = (
	importer: string,
	specifier: string,
	sources: Record<string, string>
): string | undefined => {
	let base: string
	if (specifier.startsWith('#lib/')) base = `/src/lib/${specifier.slice('#lib/'.length)}`
	else if (specifier.startsWith('.')) base = normalize(`${directoryOf(importer)}/${specifier}`)
	else return undefined

	// Sources import `./x.svelte.js` and `./x.js` for files named `x.svelte.ts` and `x.ts`.
	const withoutJs = base.endsWith('.js') ? base.slice(0, -'.js'.length) : base
	for (const candidate of [base, withoutJs]) {
		for (const suffix of RESOLVED_SUFFIXES) {
			if (candidate + suffix in sources) return candidate + suffix
		}
	}
	return undefined
}

/** Every file `entry` reaches through value imports, itself included. */
const reachableFrom = (entry: string, sources: Record<string, string>): Set<string> => {
	const reached = new Set<string>()
	const pending = [entry]

	while (pending.length > 0) {
		const file = pending.pop()
		if (file === undefined || reached.has(file)) continue
		reached.add(file)

		for (const [, typeOnly, specifier] of (sources[file] ?? '').matchAll(STATIC_IMPORT)) {
			if (typeOnly !== undefined || specifier === undefined) continue
			const target = resolveImport(file, specifier, sources)
			if (target !== undefined) pending.push(target)
		}
	}

	return reached
}

const pluginFilesReachedFrom = (entry: string, sources: Record<string, string>) =>
	[...reachableFrom(entry, sources)].filter((file) => file.startsWith(PLUGINS_ROOT)).toSorted()

describe('the scoped-scene entry', () => {
	it('reaches no file under the plugins folder', () => {
		expect(librarySources[ENTRY]).toBeDefined()
		expect(reachableFrom(ENTRY, librarySources).size).toBeGreaterThan(1)

		expect(pluginFilesReachedFrom(ENTRY, librarySources)).toEqual([])
	})

	it('would report a plugin file reached through a hook two imports away', () => {
		const sources = {
			'/src/lib/entry.ts': "export { default as Scene } from './components/Scene.svelte'",
			'/src/lib/components/Scene.svelte':
				'<script lang="ts">\n\timport { useThing } from \'#lib/hooks/useThing.svelte.js\'\n</script>',
			'/src/lib/hooks/useThing.svelte.ts':
				"import { useLogs } from '../plugins/Logs/useLogs.svelte'",
			'/src/lib/plugins/Logs/useLogs.svelte.ts': 'export const useLogs = () => {}',
		}

		expect(pluginFilesReachedFrom('/src/lib/entry.ts', sources)).toEqual([
			'/src/lib/plugins/Logs/useLogs.svelte.ts',
		])
	})

	it('does not follow a type-only import into the plugins folder', () => {
		const sources = {
			'/src/lib/entry.ts': "import type { LogTarget } from './plugins/Logs/useLogs.svelte'",
			'/src/lib/plugins/Logs/useLogs.svelte.ts': 'export interface LogTarget {}',
		}

		expect(pluginFilesReachedFrom('/src/lib/entry.ts', sources)).toEqual([])
	})
})

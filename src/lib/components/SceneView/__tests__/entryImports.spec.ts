import { describe, expect, it } from 'vitest'

/** Every source file under `src/lib` outside the specs, keyed by its path from the repo root. */
const librarySources = import.meta.glob<string>(
	['/src/lib/**/*.{ts,svelte}', '!/src/lib/**/__tests__/**', '!/src/lib/buf/**'],
	{ query: '?raw', import: 'default', eager: true }
)

const CORE_ENTRY = '/src/lib/core.ts'
const MOTION_ENTRY = '/src/lib/motion-commands.ts'
const PLUGINS_ROOT = '/src/lib/plugins/'

/** A static `import` or `export … from`, with the `type` keyword captured when the whole statement is type-only. */
const STATIC_IMPORT = /^\s*(?:import|export)\s+(type\s+)?[^'"=;()]*?from\s+['"]([^'"]+)['"]/gm

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

/** A package that only a scene needs, by the name it is imported under or a subpath of it. */
const SCENE_PACKAGE = /^(?:three|svelte|@threlte\/[^/]+)(?:\/|$)/

/** Every scene package a file reached from `entry` imports as a value, as `file imports package`. */
const scenePackagesReachedFrom = (entry: string, sources: Record<string, string>) =>
	[...reachableFrom(entry, sources)]
		.flatMap((file) =>
			[...(sources[file] ?? '').matchAll(STATIC_IMPORT)]
				.filter(
					([, typeOnly, specifier]) => typeOnly === undefined && SCENE_PACKAGE.test(specifier ?? '')
				)
				.map((match) => `${file} imports ${match[2]}`)
		)
		.toSorted()

const pluginFilesReachedFrom = (entry: string, sources: Record<string, string>) =>
	[...reachableFrom(entry, sources)].filter((file) => file.startsWith(PLUGINS_ROOT)).toSorted()

describe('the core entry', () => {
	it('reaches no file under the plugins folder', () => {
		expect(librarySources[CORE_ENTRY]).toBeDefined()
		expect(reachableFrom(CORE_ENTRY, librarySources).size).toBeGreaterThan(1)

		expect(pluginFilesReachedFrom(CORE_ENTRY, librarySources)).toEqual([])
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

describe('the motion entry', () => {
	it('reaches no file that imports three, Threlte, or Svelte', () => {
		expect(librarySources[MOTION_ENTRY]).toBeDefined()
		expect(reachableFrom(MOTION_ENTRY, librarySources).size).toBeGreaterThan(1)

		expect(scenePackagesReachedFrom(MOTION_ENTRY, librarySources)).toEqual([])
	})

	it('would report three reached through a re-export that is not marked type-only', () => {
		const sources = {
			'/src/lib/entry.ts': "export { planCommand } from './motion/planDoCommand'",
			'/src/lib/motion/planDoCommand.ts': "export { type TrajectoryStep } from './jointPose'",
			'/src/lib/motion/jointPose.ts': "import { Quaternion } from 'three'",
		}

		expect(scenePackagesReachedFrom('/src/lib/entry.ts', sources)).toEqual([
			'/src/lib/motion/jointPose.ts imports three',
		])
	})

	it('does not read an export const and a later type-only re-export as one statement', () => {
		const sources = {
			'/src/lib/entry.ts':
				"export const isDone = (steps: number[]) => {\n\treturn steps.length === 2\n}\n\nexport type { Step } from './jointPose'",
			'/src/lib/jointPose.ts': "import { Quaternion } from 'three'",
		}

		expect(scenePackagesReachedFrom('/src/lib/entry.ts', sources)).toEqual([])
	})

	it('does not count a subpath of a package whose name only starts like a scene package', () => {
		const sources = {
			'/src/lib/entry.ts':
				"import { thing } from 'three-mesh-bvh'\nimport { other } from 'svelte-virtuallists'",
		}

		expect(scenePackagesReachedFrom('/src/lib/entry.ts', sources)).toEqual([])
	})
})

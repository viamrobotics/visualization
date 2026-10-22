/**
 * Bundles the Electron main process as ESM and the preload as CommonJS into dist-electron/.
 * A sandboxed preload runs as a classic script, so it cannot be an ES module. Both target the
 * Node that ships inside Electron, not the Node running this script.
 *
 * Usage: node scripts/build-electron.mjs
 * Exit 1 when esbuild reports an error.
 */
import { build } from 'esbuild'

const ELECTRON_NODE_TARGET = 'node24'

const shared = {
	bundle: true,
	external: ['electron'],
	logLevel: 'info',
	platform: 'node',
	sourcemap: true,
	target: ELECTRON_NODE_TARGET,
}

await Promise.all([
	build({
		...shared,
		entryPoints: ['electron/main.ts'],
		format: 'esm',
		outfile: 'dist-electron/main.mjs',
	}),
	build({
		...shared,
		entryPoints: ['electron/preload.ts'],
		format: 'cjs',
		outfile: 'dist-electron/preload.cjs',
	}),
])

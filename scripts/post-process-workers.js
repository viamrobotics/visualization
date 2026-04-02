/**
 * Post-processes dist/ after svelte-package to inline web workers.
 *
 * svelte-package copies worker.ts -> worker.js into dist/ alongside the files
 * that reference them. But dist/index.js files still contain
 * `new Worker(new URL('./worker.js', import.meta.url))` which breaks when
 * consumed by another Vite project's dep optimizer.
 *
 * This script:
 *   1. Scans dist/ for JS files containing the `new Worker(new URL(...))` pattern
 *   2. Bundles the referenced worker file with esbuild into a self-contained IIFE
 *   3. Rewrites the worker instantiation to use a Blob URL instead
 *   4. Deletes the now-unnecessary worker.js file from dist/
 */

import { build } from 'esbuild'
import { globSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const WORKER_PATTERN =
	/new Worker\(new URL\(['"]([^'"]+)['"]\s*,\s*import\.meta\.url\)\s*(?:,\s*\{[^}]*\})?\)/g

const distFiles = globSync('dist/**/*.js')
const deleted = new Set()

for (const file of distFiles) {
	if (deleted.has(path.resolve(file))) continue

	const code = readFileSync(file, 'utf8')
	const matches = [...code.matchAll(WORKER_PATTERN)]

	if (matches.length === 0) continue

	let result = code

	for (const match of matches) {
		const [fullMatch, workerRelPath] = match
		const workerAbsPath = path.resolve(path.dirname(file), workerRelPath)

		console.log(`Inlining worker ${workerRelPath} referenced in ${file}`)

		const bundle = await build({
			entryPoints: [workerAbsPath],
			bundle: true,
			format: 'iife',
			write: false,
			minify: true,
		})

		const bundledCode = bundle.outputFiles[0].text
		const escaped = bundledCode
			.replaceAll('\\', '\\\\')
			.replaceAll('`', '\\`')
			.replaceAll('$', String.raw`\$`)

		const replacement = [
			`(function() {`,
			`  const __workerCode = \`${escaped}\``,
			`  const __blob = new Blob([__workerCode], { type: 'text/javascript' })`,
			`  return new Worker(URL.createObjectURL(__blob))`,
			`})()`,
		].join('\n')

		result = result.replace(fullMatch, replacement)

		try {
			unlinkSync(workerAbsPath)
			deleted.add(workerAbsPath)
			console.log(`Deleted ${workerAbsPath}`)
		} catch {
			console.warn(`Could not delete ${workerAbsPath} -- may already be removed`)
		}
	}

	writeFileSync(file, result)
	console.log(`Rewrote ${file}`)
}

console.log('Post-processed all workers in dist/')

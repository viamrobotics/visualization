// Generates the auto-generated API reference pages by running gomarkdoc on
// the Go packages and prepending Starlight frontmatter.
//
// Run from the docs/ directory:
//
//   pnpm gen:api
//
// gomarkdoc must be on $PATH (or installed under $GOPATH/bin). Outputs are
// gitignored — they're regenerated as part of `pnpm dev` / `pnpm build`.

import child_process from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const SCRIPT_DIR = path.dirname(url.fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..')
const OUT_DIR = path.resolve(SCRIPT_DIR, '..', 'src', 'content', 'docs', 'api')

const packages = [
	{
		path: './draw',
		gomarkdocHeading: '# draw',
		outFile: 'draw.md',
		title: 'draw',
		description: 'Auto-generated Go API reference for the draw package.',
	},
	{
		path: './client/api',
		gomarkdocHeading: '# api',
		outFile: 'client-api.md',
		title: 'client/api',
		description: 'Auto-generated Go API reference for the client/api package.',
	},
]

const goPath = process.env.GOPATH ?? `${process.env.HOME}/go`
const env = {
	...process.env,
	PATH: `${goPath}/bin:${process.env.PATH ?? ''}`,
}

fs.mkdirSync(OUT_DIR, { recursive: true })

for (const pkg of packages) {
	const raw = child_process.execFileSync('gomarkdoc', [pkg.path], {
		cwd: REPO_ROOT,
		env,
		encoding: 'utf8',
	})

	const stripped = raw
		.split('\n')
		.filter((line) => line !== pkg.gomarkdocHeading)
		.join('\n')

	const frontmatter = [
		'---',
		`title: ${pkg.title}`,
		`description: ${pkg.description}`,
		'---',
		'',
		'',
	].join('\n')

	const outPath = path.resolve(OUT_DIR, pkg.outFile)
	fs.writeFileSync(outPath, frontmatter + stripped)
	console.log(`wrote ${outPath}`)
}

for (const pkg of packages) {
	if (!fs.existsSync(path.resolve(OUT_DIR, pkg.outFile))) {
		throw new Error(`expected ${pkg.outFile} to exist after generation`)
	}
}

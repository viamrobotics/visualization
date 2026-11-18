/**
 * Copies the bundles in dist-desktop/ to release-assets/ under the names the Viam CLI derives,
 * viam-visualizer-<version>-<PLATFORM>-<ARCH><suffix>, with electron-updater's metadata to match.
 * Usage: PLATFORM=<darwin|linux|windows> ARCH=<aarch64|x86_64> node scripts/name-release-bundles.mjs
 * Exit 1 when PLATFORM or ARCH is unset, two bundles map to one name, or no bundle is found.
 */
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from 'node:fs'
import path from 'node:path'

const INPUT_DIR = 'dist-desktop'
const OUTPUT_DIR = 'release-assets'
// What electron-updater reads from the release: latest.yml on Windows, latest-linux.yml on Linux.
const UPDATE_METADATA = ['latest.yml', 'latest-linux.yml']
// [electron-builder ending, asset suffix], longest first so a setup installer is not taken for a plain .exe.
const SUFFIXES = [
	['-setup.exe', '-setup.exe'],
	['.exe', '.exe'],
	['.tar.gz', '.app.tar.gz'],
	['.dmg', '.dmg'],
	['.AppImage', '.AppImage'],
	['.deb', '.deb'],
]

const { ARCH, PLATFORM } = process.env
if (!PLATFORM || !ARCH) throw new Error('PLATFORM and ARCH must be set')
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

const renamed = new Map()
mkdirSync(OUTPUT_DIR)
for (const entry of readdirSync(INPUT_DIR, { withFileTypes: true })) {
	if (!entry.isFile()) continue
	const match = SUFFIXES.find(([ending]) => entry.name.endsWith(ending))
	if (!match) continue
	const name = `viam-visualizer-${version}-${PLATFORM}-${ARCH}${match[1]}`
	if ([...renamed.values()].includes(name)) throw new Error(`Two artifacts map to ${name}`)
	renamed.set(entry.name, name)
	copyFileSync(path.join(INPUT_DIR, entry.name), path.join(OUTPUT_DIR, name))
	console.log(`${entry.name} -> ${name}`)
}
if (renamed.size === 0) throw new Error('No release artifacts found')

// electron-updater fetches the files the metadata names, so those names follow the rename and
// the files' blockmaps go up beside them.
const longestFirst = [...renamed].toSorted(([a], [b]) => b.length - a.length)
for (const metadata of UPDATE_METADATA) {
	const source = path.join(INPUT_DIR, metadata)
	if (!existsSync(source)) continue
	let text = readFileSync(source, 'utf8')
	for (const [from, to] of longestFirst) {
		if (!text.includes(from)) continue
		text = text.replaceAll(from, to)
		const blockmap = path.join(INPUT_DIR, `${from}.blockmap`)
		if (existsSync(blockmap)) copyFileSync(blockmap, path.join(OUTPUT_DIR, `${to}.blockmap`))
	}
	writeFileSync(path.join(OUTPUT_DIR, metadata), text)
	console.log(`${metadata} rewritten for the release names`)
}

/**
 * Builds the draw-server Go binary as a Tauri sidecar with nlopt linked statically.
 *
 * Usage: node scripts/build-sidecar.mjs
 * Env: TAURI_ENV_TARGET_TRIPLE, NLOPT_LIBDIR, NLOPT_INCLUDEDIR (all optional).
 * Exit 1 on an unknown triple, a missing libnlopt.a, a failed build, or a dynamic link.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const TARGETS = {
	'aarch64-apple-darwin': { goos: 'darwin', goarch: 'arm64' },
	'x86_64-apple-darwin': { goos: 'darwin', goarch: 'amd64' },
	'x86_64-unknown-linux-gnu': { goos: 'linux', goarch: 'amd64' },
	'aarch64-unknown-linux-gnu': { goos: 'linux', goarch: 'arm64' },
	'x86_64-pc-windows-msvc': { goos: 'windows', goarch: 'amd64' },
	'x86_64-pc-windows-gnu': { goos: 'windows', goarch: 'amd64' },
}

const SYSTEM_LIBRARY_PREFIXES = ['/usr/lib/', '/System/']
const LINUX_ALLOWED_LIBRARIES = [
	'linux-vdso',
	'ld-linux',
	'libc.so',
	'libm.so',
	'libpthread.so',
	'libdl.so',
	'librt.so',
	'libresolv.so',
	'libstdc++.so',
	'libgcc_s.so',
]

const fail = (message) => {
	console.error(`sidecar: ${message}`)
	process.exit(1)
}

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim()

const resolveTriple = () => {
	if (process.env.TAURI_ENV_TARGET_TRIPLE) return process.env.TAURI_ENV_TARGET_TRIPLE
	const hostLine = run('rustc', ['-vV'])
		.split('\n')
		.find((line) => line.startsWith('host:'))
	if (!hostLine) fail('rustc -vV printed no host line')
	return hostLine.slice('host:'.length).trim()
}

const resolveNlopt = () => {
	const libdir = process.env.NLOPT_LIBDIR || run('pkg-config', ['--variable=libdir', 'nlopt'])
	const includedir =
		process.env.NLOPT_INCLUDEDIR || run('pkg-config', ['--variable=includedir', 'nlopt'])
	const archive = path.join(libdir, 'libnlopt.a')
	if (!existsSync(archive)) {
		fail(
			`${archive} is missing. Install nlopt with a static library (brew install nlopt on macOS, libnlopt-dev on Debian).`
		)
	}
	return { archive, includedir }
}

/**
 * Isolates the static archive in a directory of its own with a private pkg-config file.
 * go-nlopt resolves nlopt through pkg-config, and a dylib sitting beside libnlopt.a
 * would win the link, so the archive must be the only thing in the search path.
 */
const stageStaticNlopt = (stagingDir, { archive, includedir }, goos) => {
	const libDir = path.join(stagingDir, 'lib')
	const pkgConfigDir = path.join(stagingDir, 'pc')
	mkdirSync(libDir)
	mkdirSync(pkgConfigDir)
	copyFileSync(archive, path.join(libDir, 'libnlopt.a'))
	const cxxRuntime = goos === 'darwin' ? '-lc++' : '-lstdc++'
	writeFileSync(
		path.join(pkgConfigDir, 'nlopt.pc'),
		[
			'Name: nlopt',
			'Description: nlopt, statically linked',
			'Version: 0',
			`Libs: -L${libDir} -lnlopt ${cxxRuntime}`,
			`Cflags: -I${includedir}`,
			'',
		].join('\n')
	)
	return pkgConfigDir
}

const goBuild = (output, env) => {
	const result = spawnSync('go', ['build', '-o', output, './cmd/draw-server'], {
		env,
		stdio: 'inherit',
	})
	if (result.status !== 0) fail(`go build failed with status ${result.status}`)
}

const findDynamicLibraries = (goos, output) => {
	if (goos === 'darwin') {
		const libraryLines = run('otool', ['-L', output]).split('\n').slice(1)
		const offenders = libraryLines.filter(
			(line) => !SYSTEM_LIBRARY_PREFIXES.some((prefix) => line.trim().startsWith(prefix))
		)
		return { report: libraryLines.join('\n'), offenders }
	}
	const lines = run('ldd', [output]).split('\n')
	const offenders = lines.filter(
		(line) => !LINUX_ALLOWED_LIBRARIES.some((name) => line.trim().startsWith(name))
	)
	return { report: lines.join('\n'), offenders }
}

const verifyLink = (goos, output) => {
	if (goos === 'windows') {
		console.log('sidecar: skipping dynamic link check on windows')
		return
	}
	const { report, offenders } = findDynamicLibraries(goos, output)
	if (offenders.length > 0) {
		fail(`${output} links non-system libraries:\n${offenders.join('\n')}`)
	}
	console.log(report)
}

const triple = resolveTriple()
const target = TARGETS[triple]
if (!target) fail(`unknown target triple ${triple}`)

const { goos, goarch } = target
const output = path.join(
	'src-tauri',
	'binaries',
	`draw-server-${triple}${goos === 'windows' ? '.exe' : ''}`
)
mkdirSync('src-tauri/binaries', { recursive: true })

const buildEnv = { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: '1' }
if (goos === 'darwin' && goarch === 'amd64' && process.arch === 'arm64') buildEnv.CC = 'clang'

if (goos === 'windows') {
	goBuild(output, buildEnv)
} else {
	const stagingDir = mkdtempSync(path.join(tmpdir(), 'draw-server-nlopt-'))
	try {
		const pkgConfigDir = stageStaticNlopt(stagingDir, resolveNlopt(), goos)
		// An inherited CGO_LDFLAGS=-L/opt/homebrew/lib would precede our -L and pull the dylib back in.
		goBuild(output, { ...buildEnv, CGO_LDFLAGS: '', PKG_CONFIG_PATH: pkgConfigDir })
	} finally {
		rmSync(stagingDir, { recursive: true, force: true })
	}
}

verifyLink(goos, output)
console.log(`sidecar: ${output}`)

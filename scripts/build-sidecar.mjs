/**
 * Builds the draw-server Go binary for the desktop app, with nlopt linked statically, into
 * dist-sidecar/draw-server (draw-server.exe on Windows).
 *
 * Usage: node scripts/build-sidecar.mjs
 * Env: GOOS and GOARCH pick the target, defaulting to the host. NLOPT_LIBDIR and NLOPT_INCLUDEDIR
 * override pkg-config. All optional.
 * Exit 1 on an unsupported target, a missing libnlopt.a, a failed build, or a dynamic link.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const OUTPUT_DIR = 'dist-sidecar'

const SUPPORTED_TARGETS = new Set([
	'darwin/amd64',
	'darwin/arm64',
	'linux/amd64',
	'linux/arm64',
	'windows/amd64',
])

const NODE_TO_GO_OS = { darwin: 'darwin', linux: 'linux', win32: 'windows' }
const NODE_TO_GO_ARCH = { arm64: 'arm64', x64: 'amd64' }

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

const resolveTarget = () => {
	const goos = process.env.GOOS || NODE_TO_GO_OS[process.platform]
	const goarch = process.env.GOARCH || NODE_TO_GO_ARCH[process.arch]
	if (!SUPPORTED_TARGETS.has(`${goos}/${goarch}`)) fail(`unsupported target ${goos}/${goarch}`)
	return { goos, goarch }
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

const { goos, goarch } = resolveTarget()
const output = path.join(OUTPUT_DIR, `draw-server${goos === 'windows' ? '.exe' : ''}`)
mkdirSync(OUTPUT_DIR, { recursive: true })

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

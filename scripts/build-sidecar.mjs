/**
 * Builds the draw-server Go binary for the desktop app, with nlopt linked statically, into
 * dist-sidecar/draw-server. On Windows it builds dist-sidecar/draw-server.exe without cgo or IK
 * inspection (the nomotionplan tag), since RDK's nlopt solver does not support Windows.
 *
 * Usage: node scripts/build-sidecar.mjs
 * Env: GOOS and GOARCH pick the target, defaulting to the host. NLOPT_LIBDIR and NLOPT_INCLUDEDIR
 * point at a static nlopt. Without them, a host build uses .bin/nlopt-static (built by
 * etc/setup.sh) if present, then pkg-config. All optional.
 * Exit 1 on an unsupported target, a missing libnlopt.a, a failed build, or a dynamic link.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const OUTPUT_DIR = 'dist-sidecar'

// etc/setup.sh builds this for the host, since the system nlopt packages ship shared libraries only.
const LOCAL_STATIC_NLOPT = path.resolve('.bin', 'nlopt-static')

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

const pkgConfigVariable = (name) => {
	try {
		return run('pkg-config', [`--variable=${name}`, 'nlopt'])
	} catch {
		return undefined
	}
}

const isHostTarget = (goos, goarch) =>
	goos === NODE_TO_GO_OS[process.platform] && goarch === NODE_TO_GO_ARCH[process.arch]

/** Where nlopt's static library and headers are: env, then the local copy for a host build, then pkg-config. */
const resolveNloptDirs = (goos, goarch) => {
	if (process.env.NLOPT_LIBDIR && process.env.NLOPT_INCLUDEDIR) {
		return { libdir: process.env.NLOPT_LIBDIR, includedir: process.env.NLOPT_INCLUDEDIR }
	}
	const localLibdir = path.join(LOCAL_STATIC_NLOPT, 'lib')
	if (isHostTarget(goos, goarch) && existsSync(path.join(localLibdir, 'libnlopt.a'))) {
		return { libdir: localLibdir, includedir: path.join(LOCAL_STATIC_NLOPT, 'include') }
	}
	return {
		libdir: process.env.NLOPT_LIBDIR || pkgConfigVariable('libdir'),
		includedir: process.env.NLOPT_INCLUDEDIR || pkgConfigVariable('includedir'),
	}
}

const resolveNlopt = (goos, goarch) => {
	const { libdir, includedir } = resolveNloptDirs(goos, goarch)
	const archive = libdir && path.join(libdir, 'libnlopt.a')
	if (!archive || !includedir || !existsSync(archive)) {
		fail(
			`no static nlopt found${archive ? ` (${archive} is missing)` : ''}. Run etc/setup.sh, or scripts/build-static-nlopt.sh ${LOCAL_STATIC_NLOPT}.`
		)
	}
	return { archive, includedir }
}

/**
 * Isolates the static archive in a directory of its own with a private pkg-config file.
 * go-nlopt resolves nlopt through pkg-config, and a dylib sitting beside libnlopt.a
 * would win the link, so the archive must be the only thing in the search path.
 *
 * @returns The staged library directory and the directory holding nlopt.pc.
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
			// -lm follows -lnlopt because GNU ld resolves static archives left to right. go-nlopt's own
			// -lm comes first on the link line, too early to satisfy libnlopt.a on Linux.
			`Libs: -L${libDir} -lnlopt -lm ${cxxRuntime}`,
			`Cflags: -I${includedir}`,
			'',
		].join('\n')
	)
	return { libDir, pkgConfigDir }
}

// -s -w drop the symbol table and DWARF, about a third of the binary. Panics still name functions.
const STRIP_FLAGS = ['-trimpath', '-ldflags=-s -w']

const goBuild = (output, env, extraArgs) => {
	const args = ['build', ...STRIP_FLAGS, ...extraArgs, '-o', output, './cmd/draw-server']
	const result = spawnSync('go', args, { env, stdio: 'inherit' })
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
	// RDK's nlopt IK solver excludes Windows (go.viam.com/rdk motionplan/ik/nlopt.go is !windows), so
	// the Windows sidecar drops IK inspection. Nothing else needs cgo, so no C toolchain either.
	goBuild(output, { ...buildEnv, CGO_ENABLED: '0' }, ['-tags=nomotionplan'])
} else {
	const stagingDir = mkdtempSync(path.join(tmpdir(), 'draw-server-nlopt-'))
	try {
		const { libDir, pkgConfigDir } = stageStaticNlopt(stagingDir, resolveNlopt(goos, goarch), goos)
		// An inherited -L/opt/homebrew/lib would precede ours and pull the dylib back in. An empty
		// CGO_LDFLAGS falls back to `go env` config, so it is set to our directory instead, and
		// LIBRARY_PATH is cleared because the C linker searches it too.
		goBuild(
			output,
			{ ...buildEnv, CGO_LDFLAGS: `-L${libDir}`, LIBRARY_PATH: '', PKG_CONFIG_PATH: pkgConfigDir },
			[]
		)
	} finally {
		rmSync(stagingDir, { recursive: true, force: true })
	}
}

verifyLink(goos, output)
console.log(`sidecar: ${output}`)

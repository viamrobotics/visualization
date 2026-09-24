/**
 * Transforms the gltf and glb files in static/models into Threlte components and
 * moves them into src/lib/components/models.
 *
 * Usage: node scripts/model-pipeline.js
 */
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { exit } from 'node:process'

const configuration = {
	sourceDir: path.resolve(path.join('static', 'models')),
	targetDir: path.resolve(path.join('src', 'lib', 'components', 'models')),
	overwrite: false,
	root: '/models/',
	types: true,
	keepnames: false,
	meta: false,
	shadows: false,
	printwidth: 120,
	precision: 2,
	draco: null,
	preload: false,
	suspense: false,
	isolated: false,
	transform: {
		enabled: false,
		resolution: 1024,
		simplify: {
			enabled: false,
			weld: 0.0001,
			ratio: 0.75,
			error: 0.001,
		},
	},
}

mkdirSync(configuration.targetDir, { recursive: true })

if (!existsSync(configuration.sourceDir)) {
	throw new Error(`Source directory ${configuration.sourceDir} doesn't exist.`)
}

// read the directory, filter for .glb and .gltf files and files *not* ending
// with -transformed.gltf or -transformed.glb as these should not be transformed
// again.
const gltfFiles = readdirSync(configuration.sourceDir).filter((file) => {
	return (
		(file.endsWith('.glb') || file.endsWith('.gltf')) &&
		!file.endsWith('-transformed.gltf') &&
		!file.endsWith('-transformed.glb')
	)
})

if (gltfFiles.length === 0) {
	console.log('No gltf or glb files found.')
	exit()
}

const filteredGltfFiles = gltfFiles.filter((file) => {
	if (!configuration.overwrite) {
		const componentFilename = file.split('.').slice(0, -1).join('.') + '.svelte'
		const componentPath = path.join(configuration.targetDir, componentFilename)
		if (existsSync(componentPath)) {
			console.error(`File ${componentPath} already exists, skipping.`)
			return false
		}
	}
	return true
})

if (filteredGltfFiles.length === 0) {
	console.log('No gltf or glb files to process.')
	exit()
}

for (const file of filteredGltfFiles) {
	const path = path.join(configuration.sourceDir, file)

	const args = []
	if (configuration.root) args.push(`--root ${configuration.root}`)
	if (configuration.types) args.push('--types')
	if (configuration.keepnames) args.push('--keepnames')
	if (configuration.meta) args.push('--meta')
	if (configuration.shadows) args.push('--shadows')
	args.push(`--printwidth ${configuration.printwidth}`, `--precision ${configuration.precision}`)
	if (configuration.draco) args.push(`--draco ${configuration.draco}`)
	if (configuration.preload) args.push('--preload')
	if (configuration.suspense) args.push('--suspense')
	if (configuration.isolated) args.push('--isolated')
	if (configuration.transform.enabled) {
		args.push(`--transform`, `--resolution ${configuration.transform.resolution}`)
		if (configuration.transform.simplify.enabled) {
			args.push(
				`--simplify`,
				`--weld ${configuration.transform.simplify.weld}`,
				`--ratio ${configuration.transform.simplify.ratio}`,
				`--error ${configuration.transform.simplify.error}`
			)
		}
	}
	const formattedArgs = args.join(' ')

	const cmd = `npx @threlte/gltf@latest ${path} ${formattedArgs}`
	try {
		execSync(cmd, {
			cwd: configuration.sourceDir,
		})
	} catch (error) {
		console.error(`Error transforming model: ${error}`)
	}
}

const svelteFiles = readdirSync(configuration.sourceDir).filter((file) => file.endsWith('.svelte'))

for (const file of svelteFiles) {
	const path = path.join(configuration.sourceDir, file)
	const newPath = path.join(configuration.targetDir, file)
	copyFile: try {
		// The CLI runs between the read of the directory and this copy, so the
		// destination is re-checked here.
		if (!configuration.overwrite && existsSync(newPath)) {
			console.error(`File ${newPath} already exists, skipping.`)
			break copyFile
		}
		copyFileSync(path, newPath)
	} catch (error) {
		console.error(`Error copying file: ${error}`)
	}

	try {
		unlinkSync(path)
	} catch (error) {
		console.error(`Error removing file: ${error}`)
	}
}

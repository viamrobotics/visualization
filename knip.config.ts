export default {
	// scripts/build-electron.mjs bundles these, which knip cannot see through.
	entry: ['electron/main.ts', 'electron/preload.ts'],
	compilers: {
		svelte: (text: string) => {
			const scripts = [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
			return scripts.map((match) => match[1]).join('\n')
		},
	},
}

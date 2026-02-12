export default {
	compilers: {
		svelte: (text: string) => {
			const scripts = [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
			return scripts.map((match) => match[1]).join('\n')
		},
	},
}

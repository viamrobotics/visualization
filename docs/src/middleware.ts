import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { defineMiddleware } from 'astro:middleware'

// In dev, Starlight's `[...slug]` catch-all matches `/playground/` and 404s
// before Vite's static-file middleware gets a chance to resolve the
// directory's `index.html`. Read the file ourselves so the SvelteKit app
// build at `public/playground/index.html` is served at the bare URL.
//
// Production is unaffected — GitHub Pages serves the static file directly,
// without Astro routing involved.
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const playgroundIndex = join(projectRoot, 'public', 'playground', 'index.html')

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url

	if (pathname === '/playground' || pathname === '/playground/') {
		const html = await readFile(playgroundIndex, 'utf8')
		return new Response(html, {
			status: 200,
			headers: { 'content-type': 'text/html; charset=utf-8' },
		})
	}

	return next()
})

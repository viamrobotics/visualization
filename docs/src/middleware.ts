import { defineMiddleware } from 'astro:middleware'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// In dev, Starlight's `[...slug]` catch-all matches `/playground/` and 404s
// before Vite's static-file middleware gets a chance to resolve the
// directory's `index.html`. Read the file ourselves so the SvelteKit app
// build at `public/playground/index.html` is served at the bare URL.
//
// Production is unaffected — GitHub Pages serves the static file directly,
// without Astro routing involved.
const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const playgroundIndex = path.join(projectRoot, 'public', 'playground', 'index.html')
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const playgroundPaths = new Set([`${base}/playground`, `${base}/playground/`])

export const onRequest = defineMiddleware(async (context, next) => {
	if (playgroundPaths.has(context.url.pathname)) {
		const html = await readFile(playgroundIndex, 'utf8')
		return new Response(html, {
			status: 200,
			headers: { 'content-type': 'text/html; charset=utf-8' },
		})
	}

	return next()
})

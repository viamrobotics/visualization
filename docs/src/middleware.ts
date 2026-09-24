import { defineMiddleware } from 'astro:middleware'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const playgroundDir = path.join(projectRoot, 'public', 'playground')
const base = import.meta.env.BASE_URL.replace(/\/$/, '')

// SvelteKit emits relative asset paths, so each HTML resolves only at one URL:
// /playground/ for index.html and /playground/snapshot for snapshot.html.
const playgroundPaths = {
	[`${base}/playground/`]: 'index.html',
	[`${base}/playground/snapshot`]: 'snapshot.html',
}

const playgroundRedirects = {
	[`${base}/playground`]: `${base}/playground/`,
	[`${base}/playground/snapshot/`]: `${base}/playground/snapshot`,
}

/**
 * Serves the SvelteKit playground build from public/playground during dev.
 *
 * Starlight's catch-all route matches these URLs and 404s before Vite's static
 * middleware sees them. Production is unaffected, because GitHub Pages serves the
 * files directly.
 */
export const onRequest = defineMiddleware(async (context, next) => {
	const redirectTo = playgroundRedirects[context.url.pathname]
	if (redirectTo) {
		return Response.redirect(new URL(redirectTo, context.url), 307)
	}

	const file = playgroundPaths[context.url.pathname]
	if (file) {
		const html = await readFile(path.join(playgroundDir, file), 'utf8')
		return new Response(html, {
			status: 200,
			headers: { 'content-type': 'text/html; charset=utf-8' },
		})
	}

	return next()
})

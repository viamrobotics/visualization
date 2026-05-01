import { defineMiddleware } from 'astro:middleware'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// In dev, Starlight's `[...slug]` catch-all matches playground URLs and 404s
// before Vite's static-file middleware gets a chance to resolve them. Read the
// matching files ourselves so the SvelteKit app build under `public/playground/`
// is served at the bare URLs.
//
// Production is unaffected — GitHub Pages serves the static files directly,
// without Astro routing involved.
//
// Each HTML must be served at exactly one canonical URL: SvelteKit emits
// relative asset paths (e.g. `./_app/...`) which only resolve correctly when
// the document URL ends at the right "directory" — `/playground/` for
// index.html, `/playground/snapshot` (no trailing slash) for snapshot.html.
// Off-canonical forms get redirected so stale links keep working.
const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const playgroundDir = path.join(projectRoot, 'public', 'playground')
const base = import.meta.env.BASE_URL.replace(/\/$/, '')

const playgroundPaths = {
	[`${base}/playground/`]: 'index.html',
	[`${base}/playground/snapshot`]: 'snapshot.html',
}

const playgroundRedirects = {
	[`${base}/playground`]: `${base}/playground/`,
	[`${base}/playground/snapshot/`]: `${base}/playground/snapshot`,
}

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

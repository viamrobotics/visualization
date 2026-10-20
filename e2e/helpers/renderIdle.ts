import type { Page } from '@playwright/test'

interface PageThrelte {
	__threlte__?: { renderer?: { info?: { render?: { frame?: number } } } }
}

const readFrame = () =>
	(globalThis as PageThrelte).__threlte__?.renderer?.info?.render?.frame ?? null

/**
 * How many frames the renderer has drawn, or null before the scene mounts.
 *
 * The app runs Threlte in `on-demand` mode, so this only moves when something
 * calls `invalidate()`. That is what makes it a readiness signal rather than a
 * clock: a settled scene stops incrementing it entirely.
 */
export const readRenderFrame = (page: Page): Promise<number | null> => page.evaluate(readFrame)

interface WaitForRenderIdleOptions {
	/**
	 * Wait for the counter to move past this before watching for it to stop.
	 *
	 * Without it a scene that has not started reacting yet already looks idle, so
	 * the wait returns before the change under test has rendered. Pass the value
	 * `readRenderFrame` gave before the mutation.
	 */
	after?: number | null
	/** How long the counter must hold still to count as settled. */
	stableMs?: number
	timeoutMs?: number
}

/**
 * Waits until the renderer has stopped drawing.
 *
 * Replaces a fixed sleep after an action that changes the scene. Entities and
 * their axes helpers flush through separate batched renderers, so a change can
 * take several frames to land; waiting for the counter to go quiet covers all
 * of them without guessing at a duration.
 *
 * @throws if the scene never renders, or never stops.
 */
export const waitForRenderIdle = async (
	page: Page,
	{ after, stableMs = 300, timeoutMs = 15_000 }: WaitForRenderIdleOptions = {}
): Promise<void> => {
	const outcome = await page.evaluate(
		async ({ after, stableMs, timeoutMs }) => {
			const frame = () =>
				(globalThis as PageThrelte).__threlte__?.renderer?.info?.render?.frame ?? null
			const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

			const deadline = Date.now() + timeoutMs
			let advanced = after === undefined || after === null
			let last = frame()
			let stableSince = Date.now()

			while (Date.now() < deadline) {
				await sleep(50)
				const current = frame()

				// The scene has not mounted yet, so there is nothing to be idle about.
				if (current === null) {
					stableSince = Date.now()
					continue
				}

				if (!advanced) {
					if (current > (after as number)) advanced = true
					last = current
					stableSince = Date.now()
					continue
				}

				if (current !== last) {
					last = current
					stableSince = Date.now()
					continue
				}

				if (Date.now() - stableSince >= stableMs) return 'idle'
			}

			return advanced ? 'never-settled' : 'never-rendered'
		},
		{ after, stableMs, timeoutMs }
	)

	if (outcome === 'never-rendered') {
		throw new Error(
			`Nothing rendered within ${timeoutMs}ms: the render frame count never moved past ${after}.`
		)
	}
	if (outcome === 'never-settled') {
		throw new Error(`The scene was still rendering after ${timeoutMs}ms.`)
	}
}

import { sequence } from '@sveltejs/kit/hooks'
import { handleErrorWithSentry, sentryHandle } from '@sentry/sveltekit'
import * as Sentry from '@sentry/sveltekit'
import { noop } from 'lodash-es'

// If you have custom handlers, make sure to place them after `sentryHandle()` in the `sequence` function.
export let handle: ReturnType<typeof sequence> = async ({ event, resolve }) => resolve(event)
export let handleError: ReturnType<typeof handleErrorWithSentry> = () => noop()

if (import.meta.env.MODE === 'production') {
	Sentry.init({
		dsn: 'https://221c5ddd7e532dad95be66b8b6fabf2d@o1356192.ingest.us.sentry.io/4509599892897792',

		tracesSampleRate: 1.0,

		// uncomment the line below to enable Spotlight (https://spotlightjs.com)
		// spotlight: import.meta.env.DEV,
	})

	handle = sequence(sentryHandle())

	// If you have a custom error handler, pass it to `handleErrorWithSentry`
	handleError = handleErrorWithSentry()
}

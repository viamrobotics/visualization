import { handleErrorWithSentry, sentryHandle } from '@sentry/sveltekit'
import * as Sentry from '@sentry/sveltekit'
import { sequence } from '@sveltejs/kit/hooks'

Sentry.init({
	dsn: 'https://221c5ddd7e532dad95be66b8b6fabf2d@o1356192.ingest.us.sentry.io/4509599892897792',

	tracesSampleRate: 1,
})

export const handle = sequence(sentryHandle())

export const handleError = handleErrorWithSentry()

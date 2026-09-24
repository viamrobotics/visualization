import { handleErrorWithSentry, replayIntegration } from '@sentry/sveltekit'
import * as Sentry from '@sentry/sveltekit'

import { version } from '../package.json'

if (import.meta.env.PROD) {
	Sentry.init({
		release: version,
		dsn: 'https://221c5ddd7e532dad95be66b8b6fabf2d@o1356192.ingest.us.sentry.io/4509599892897792',

		tracesSampleRate: 1,

		replaysSessionSampleRate: 0.1,

		// If the entire session is not sampled, use the below sample rate to sample
		// sessions when an error occurs.
		replaysOnErrorSampleRate: 1,

		integrations: [replayIntegration()],
	})
}

export const handleError = handleErrorWithSentry()

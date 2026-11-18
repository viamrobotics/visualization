import { Code, ConnectError, createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { del, get, set } from 'idb-keyval'
import { getContext, setContext } from 'svelte'

import { ViamLoginService } from '$lib/buf/viamlogin/v1/viamlogin_connect'
import { LoginStatus, type Session } from '$lib/buf/viamlogin/v1/viamlogin_pb'

const key = Symbol('viam-session-context')
const STORAGE_KEY = 'viam-session'
// Refresh this long before expiry, so a token never lapses between scheduling and use.
const REFRESH_LEAD_MS = 60_000
// A refresh that fails for a reason other than a revoked token, such as the draw server restarting.
const REFRESH_RETRY_MS = 30_000
// RFC 8628 section 3.5: each slow_down response adds 5 seconds to the polling interval.
const SLOW_DOWN_STEP_MS = 5000

/** A logged-in session as kept in IndexedDB, beside the manual connection configs. */
export interface ViamSession {
	accessToken: string
	refreshToken: string
	/** Epoch milliseconds. */
	expiresAt: number
	email: string
	/** Empty when the ID token carries no name claims. */
	displayName: string
}

export interface PendingLogin {
	userCode: string
	verificationUri: string
	/** Epoch milliseconds. */
	expiresAt: number
}

export type ViamSessionState =
	| { status: 'restoring' }
	| { status: 'logged-out' }
	| { status: 'awaiting-approval'; pending: PendingLogin }
	| { status: 'active'; session: ViamSession }

interface Context {
	readonly state: ViamSessionState
	readonly error: string | undefined
	/** Starts a device-code login and opens the approval page in a new tab. */
	login: () => Promise<void>
	cancelLogin: () => void
	logout: () => void
}

const toViamSession = (session: Session): ViamSession => ({
	accessToken: session.accessToken,
	refreshToken: session.refreshToken,
	expiresAt: Date.now() + session.expiresInSeconds * 1000,
	email: session.email,
	displayName: session.displayName,
})

const isViamSession = (value: unknown): value is ViamSession =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as ViamSession).accessToken === 'string' &&
	typeof (value as ViamSession).refreshToken === 'string' &&
	typeof (value as ViamSession).expiresAt === 'number' &&
	typeof (value as ViamSession).email === 'string' &&
	typeof (value as ViamSession).displayName === 'string'

const describeLoginError = (error: unknown): string => {
	const connectError = ConnectError.from(error)
	switch (connectError.code) {
		case Code.DeadlineExceeded: {
			return 'The login code expired. Start again.'
		}
		case Code.PermissionDenied: {
			return 'The login was denied.'
		}
		default: {
			return `Login failed: ${connectError.rawMessage}`
		}
	}
}

/**
 * Holds the Viam account session for the local app. Tokens come from the draw server's
 * `ViamLoginService`, since Viam's auth server rejects requests from a browser origin.
 *
 * @param getBaseUrl The draw server URL, or undefined until the desktop sidecar reports its
 *   port. Restoring a saved session waits for it.
 */
export const provideViamSession = (getBaseUrl: () => string | undefined): Context => {
	let state = $state<ViamSessionState>({ status: 'restoring' })
	let error = $state<string>()

	// Bumped to cancel an in-flight login poll or refresh. Each async step checks it after awaiting.
	let generation = 0
	let refreshTimer: ReturnType<typeof setTimeout> | undefined

	const client = () => {
		const baseUrl = getBaseUrl()
		if (!baseUrl) throw new Error('The draw server is not running')
		return createClient(ViamLoginService, createConnectTransport({ baseUrl }))
	}

	const clearRefresh = () => {
		clearTimeout(refreshTimer)
		refreshTimer = undefined
	}

	const endSession = (message?: string) => {
		generation += 1
		clearRefresh()
		void del(STORAGE_KEY)
		state = { status: 'logged-out' }
		error = message
	}

	const activate = (session: ViamSession) => {
		state = { status: 'active', session }
		error = undefined
		void set(STORAGE_KEY, session)
		scheduleRefresh(session, session.expiresAt - REFRESH_LEAD_MS - Date.now())
	}

	const scheduleRefresh = (session: ViamSession, delayMs: number) => {
		clearRefresh()
		refreshTimer = setTimeout(() => void refresh(session), Math.max(0, delayMs))
	}

	const refresh = async (session: ViamSession) => {
		const id = generation
		try {
			const response = await client().refreshLogin({ refreshToken: session.refreshToken })
			if (id !== generation || !response.session) return
			activate(toViamSession(response.session))
		} catch (refreshError) {
			if (id !== generation) return
			if (ConnectError.from(refreshError).code === Code.Unauthenticated) {
				endSession('Your Viam session expired. Log in again.')
				return
			}
			// Keep the session. Its token may still have a minute left, and the next try may succeed.
			if (state.status === 'restoring') state = { status: 'active', session }
			error = `Could not refresh the Viam session: ${ConnectError.from(refreshError).rawMessage}`
			scheduleRefresh(session, REFRESH_RETRY_MS)
		}
	}

	const pollUntilApproved = async (id: number, deviceCode: string, intervalSeconds: number) => {
		let intervalMs = intervalSeconds * 1000
		for (;;) {
			await new Promise((resolve) => setTimeout(resolve, intervalMs))
			if (id !== generation) return

			const response = await client().pollLogin({ deviceCode })
			if (id !== generation) return

			if (response.status === LoginStatus.SLOW_DOWN) intervalMs += SLOW_DOWN_STEP_MS
			if (response.status === LoginStatus.APPROVED && response.session) {
				activate(toViamSession(response.session))
				return
			}
		}
	}

	const login = async () => {
		generation += 1
		const id = generation
		clearRefresh()
		error = undefined

		try {
			const start = await client().startLogin({})
			if (id !== generation) return

			state = {
				status: 'awaiting-approval',
				pending: {
					userCode: start.userCode,
					verificationUri: start.verificationUriComplete,
					expiresAt: Date.now() + start.expiresInSeconds * 1000,
				},
			}
			// Still inside the click's transient activation, so popup blockers allow it. The panel
			// keeps a link to reopen the page in case one does not.
			window.open(start.verificationUriComplete, '_blank', 'noopener')

			await pollUntilApproved(id, start.deviceCode, start.intervalSeconds)
		} catch (loginError) {
			if (id !== generation) return
			state = { status: 'logged-out' }
			error = describeLoginError(loginError)
		}
	}

	let isRestoreStarted = false

	$effect(() => {
		if (isRestoreStarted || !getBaseUrl()) return
		isRestoreStarted = true

		void get(STORAGE_KEY).then((stored: unknown) => {
			if (state.status !== 'restoring') return
			if (!isViamSession(stored)) {
				state = { status: 'logged-out' }
				return
			}
			if (stored.expiresAt - REFRESH_LEAD_MS > Date.now()) {
				activate(stored)
				return
			}
			void refresh(stored)
		})
	})

	$effect(() => {
		return () => {
			generation += 1
			clearRefresh()
		}
	})

	const context: Context = {
		get state() {
			return state
		},
		get error() {
			return error
		},
		login,
		cancelLogin: () => endSession(),
		logout: () => endSession(),
	}

	setContext(key, context)
	return context
}

export const useViamSession = (): Context => getContext(key)

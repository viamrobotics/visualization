import { type appApi, createViamClient, type ViamClient } from '@viamrobotics/sdk'
import { PersistedState } from 'runed'
import { getContext, setContext } from 'svelte'

const key = Symbol('account-machines-context')
const SERVICE_HOST = 'https://app.viam.com'

interface Context {
	readonly organizations: appApi.Organization[]
	readonly locations: appApi.LocationSummary[]
	organizationId: string
	/** True while a fetch is in flight, including a background refetch over cached results. */
	readonly isLoading: boolean
	readonly error: string | undefined
	refetch: () => void
	/** The part's FQDN, which is the host to dial. */
	resolveHost: (partId: string) => Promise<string>
}

/**
 * Lists the organizations and machines the logged-in account can see. Provided once at the
 * layout, so results survive the machines popover unmounting and reopen instantly while a
 * refetch runs. Uses its own app client, because the app-wide `ViamAppProvider` carries
 * whichever machine's credentials are active.
 *
 * @param getAccessToken The session's current access token. A refresh rebuilds the client and
 *   refetches, keeping the previous lists on screen meanwhile. Logging out clears them.
 */
export const provideAccountMachines = (getAccessToken: () => string | undefined): Context => {
	let client = $state.raw<ViamClient>()
	let organizations = $state.raw<appApi.Organization[]>([])
	let locations = $state.raw<appApi.LocationSummary[]>([])
	let isLoading = $state(false)
	let error = $state<string>()
	// Bumped by refetch() so the list effect reruns without a token or org change.
	let refetchCount = $state(0)

	const organizationId = new PersistedState<string>('viam-account-organization', '')

	$effect(() => {
		const accessToken = getAccessToken()
		if (!accessToken) {
			client = undefined
			organizations = []
			locations = []
			error = undefined
			return
		}

		let isCancelled = false
		void (async () => {
			try {
				const nextClient = await createViamClient({
					serviceHost: SERVICE_HOST,
					credentials: { type: 'access-token', payload: accessToken },
				})
				const nextOrganizations = await nextClient.appClient.listOrganizations()
				if (isCancelled) return

				client = nextClient
				organizations = nextOrganizations
				error = undefined
				if (!nextOrganizations.some(({ id }) => id === organizationId.current)) {
					organizationId.current = nextOrganizations[0]?.id ?? ''
				}
			} catch (listError) {
				if (!isCancelled) error = `Could not list organizations: ${(listError as Error).message}`
			}
		})()

		return () => {
			isCancelled = true
		}
	})

	$effect(() => {
		const currentClient = client
		const currentOrganizationId = organizationId.current
		void refetchCount
		if (!currentClient || !currentOrganizationId) return

		let isCancelled = false
		isLoading = true
		error = undefined

		currentClient.appClient
			.listMachineSummaries(currentOrganizationId)
			.then((summaries) => {
				if (!isCancelled) locations = summaries
			})
			.catch((listError: Error) => {
				if (!isCancelled) error = `Could not list machines: ${listError.message}`
			})
			.finally(() => {
				if (!isCancelled) isLoading = false
			})

		return () => {
			isCancelled = true
			// A cancelled fetch never reaches finally's reset, and nothing may rerun to clear it.
			isLoading = false
		}
	})

	const context: Context = {
		get organizations() {
			return organizations
		},
		get locations() {
			return locations
		},
		get organizationId() {
			return organizationId.current
		},
		set organizationId(id: string) {
			locations = []
			organizationId.current = id
		},
		get isLoading() {
			return isLoading
		},
		get error() {
			return error
		},
		refetch: () => {
			refetchCount += 1
		},
		resolveHost: async (partId) => {
			if (!client) throw new Error('Not logged in to Viam')
			const { part } = await client.appClient.getRobotPart(partId)
			if (!part?.fqdn) throw new Error(`Part ${partId} has no address`)
			return part.fqdn
		},
	}

	setContext(key, context)
	return context
}

export const useAccountMachines = (): Context => getContext(key)

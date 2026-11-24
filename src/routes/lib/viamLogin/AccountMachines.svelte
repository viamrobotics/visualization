<script lang="ts">
	import {
		mdiBroadcast,
		mdiBroadcastOff,
		mdiChevronDown,
		mdiMagnify,
		mdiMultiplicationBox,
		mdiSelectionEllipse,
	} from '@mdi/js'
	import { TextField } from '@viamrobotics/prime-controls'
	import { Banner, Icon } from '@viamrobotics/prime-ui'
	import { appApi } from '@viamrobotics/sdk'
	import { PersistedState } from 'runed'
	import { type Snippet, untrack } from 'svelte'
	import { VirtualList } from 'svelte-virtuallists'

	import { useActiveConnectionConfig } from '../hooks/useConnectionConfigs.svelte'
	import { machineListItemHeight, toMachineListItems } from './machineListItems'
	import {
		type MachineSort,
		type MachineSortProperty,
		nextMachineSort,
		toMachineRows,
	} from './machineRows'
	import OrgMenu from './OrgMenu.svelte'
	import Star from './Star.svelte'
	import { useAccountMachines } from './useAccountMachines.svelte'
	import { useAccountPart } from './useAccountPart.svelte'
	import { useFavoriteMachines } from './useFavoriteMachines.svelte'
	import UserMenu from './UserMenu.svelte'
	import { useViamSession } from './useViamSession.svelte'

	interface Props {
		/** A CLI launch file overrides any pick, so the list is shown but cannot be used. */
		isLaunched: boolean
	}

	const { isLaunched }: Props = $props()

	const COUNTDOWN_TICK_MS = 1000

	const session = useViamSession()
	const accountPart = useAccountPart()
	const activeConfig = useActiveConnectionConfig()

	const machines = useAccountMachines()
	const favorites = useFavoriteMachines()

	// The popover mounts this panel each time it opens. Cached results show while this refetch runs.
	$effect(() => {
		untrack(() => {
			machines.refetch()
			favorites.refetch()
		})
	})

	let filter = $state('')
	let pickingPartId = $state<string>()
	let pickError = $state<string>()
	let now = $state(Date.now())

	const sort = new PersistedState<MachineSort>('viam-account-machine-order', {
		property: 'status',
		direction: 'ascending',
	})

	const rows = $derived(
		toMachineRows(
			machines.locations,
			filter,
			sort.current,
			favorites.isFavoritesFirst ? favorites.ids : null
		)
	)
	const items = $derived(toMachineListItems(rows))
	// The list's full height. Flex shrinks it to the space left in the popover, where it scrolls.
	const contentHeight = $derived(items.reduce((sum, item) => sum + machineListItemHeight(item), 0))

	const error = $derived(pickError ?? session.error ?? machines.error ?? favorites.error)

	$effect(() => {
		if (session.state.status !== 'awaiting-approval') return
		const ticker = setInterval(() => {
			now = Date.now()
		}, COUNTDOWN_TICK_MS)
		return () => clearInterval(ticker)
	})

	const formatCountdown = (expiresAt: number) => {
		const seconds = Math.max(0, Math.round((expiresAt - now) / 1000))
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
	}

	const formatLastOnline = (secondsSinceOnline: bigint) => {
		const seconds = Number(secondsSinceOnline)
		if (seconds < 60) return 'just now'
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
		if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
		return `${Math.floor(seconds / 86_400)}d ago`
	}

	const pick = async (machine: appApi.MachineSummary, part: appApi.PartSummary) => {
		if (accountPart.current?.partId === part.partId) {
			accountPart.set(null)
			return
		}

		pickingPartId = part.partId
		pickError = undefined
		try {
			const host = await machines.resolveHost(part.partId)
			accountPart.set({
				partId: part.partId,
				partName: part.partName,
				machineName: machine.machineName,
				host,
			})
			activeConfig.set(undefined)
		} catch (resolveError) {
			pickError = `Could not connect to ${machine.machineName}: ${(resolveError as Error).message}`
		} finally {
			pickingPartId = undefined
		}
	}
</script>

<!-- Icons and colors follow app.viam.com's machines page, except offline stays grey. -->
{#snippet partStatus(part: appApi.PartSummary)}
	<span class="flex shrink-0 items-center gap-1 text-xs">
		{#if pickingPartId === part.partId}
			<span
				class="progress-dots"
				role="status"
				aria-label="Connecting"
			></span>
		{/if}
		{#if part.onlineState === appApi.OnlineState.ONLINE}
			<Icon
				icon={mdiBroadcast}
				class="text-success-dark"
			/>
			<span class="text-success-dark">Online</span>
		{:else if part.onlineState === appApi.OnlineState.AWAITING_SETUP}
			<Icon
				icon={mdiSelectionEllipse}
				class="text-info-dark"
			/>
			<span class="text-info-dark">Awaiting setup</span>
		{:else}
			<Icon
				icon={mdiBroadcastOff}
				class="text-gray-6"
			/>
			<span class="text-subtle-2">Offline · {formatLastOnline(part.secondsSinceOnline)}</span>
		{/if}
	</span>
{/snippet}

{#snippet machineName(name: string, locationName: string, isPicked: boolean)}
	<span class="flex min-w-0 flex-col">
		<span class={['truncate text-sm leading-5', isPicked && 'text-heading font-medium']}
			>{name}</span
		>
		<span class="text-subtle-2 truncate text-xs leading-4">{locationName}</span>
	</span>
{/snippet}

{#snippet pickButton(
	machine: appApi.MachineSummary,
	part: appApi.PartSummary,
	heightClass: string,
	isMachineLine: boolean,
	label: Snippet<[boolean]>
)}
	{@const isPicked = accountPart.current?.partId === part.partId}
	{#snippet button()}
		<button
			type="button"
			aria-pressed={isPicked}
			aria-disabled={isLaunched || undefined}
			class={[
				'flex h-full min-w-0 flex-1 items-center justify-between gap-2 pr-4 pl-2 text-left',
				'focus-visible:outline-gray-9 focus-visible:outline-2 focus-visible:-outline-offset-2',
				isLaunched
					? 'text-disabled cursor-not-allowed'
					: 'text-subtle-1 hover:text-default transition-colors duration-200',
				isPicked && 'text-default',
			]}
			onclick={() => {
				if (!isLaunched) void pick(machine, part)
			}}
		>
			{@render label(isPicked)}
			{@render partStatus(part)}
		</button>
	{/snippet}
	{@render listRow(heightClass, isMachineLine ? machine : undefined, isPicked, button)}
{/snippet}

<!--
	One line of the list: a favorite star cell, then the content. The row carries the fill so the
	star cell highlights with the rest of a picked row.
-->
{#snippet listRow(
	heightClass: string,
	favoriteMachine: appApi.MachineSummary | undefined,
	isPicked: boolean,
	content: Snippet
)}
	<div
		class={[
			'border-light flex items-center border-b',
			heightClass,
			// Matches a selected WorldTree row.
			isPicked ? 'bg-medium' : !isLaunched && 'hover:bg-light',
		]}
	>
		<span class="flex w-8 shrink-0 justify-end">
			{#if favoriteMachine}
				{@const isFavorite = favorites.ids.has(favoriteMachine.machineId)}
				{@const favoriteLabel = isFavorite
					? `Remove ${favoriteMachine.machineName} from favorites`
					: `Add ${favoriteMachine.machineName} to favorites`}
				<button
					type="button"
					aria-label={favoriteLabel}
					aria-pressed={isFavorite}
					title={favoriteLabel}
					class={[
						'focus-visible:outline-gray-9 inline-flex rounded focus-visible:outline-2',
						isFavorite ? 'text-warning-bright' : 'text-gray-6 hover:text-gray-8',
					]}
					onclick={() => void favorites.setFavorite(favoriteMachine.machineId, !isFavorite)}
				>
					<Star isFilled={isFavorite} />
				</button>
			{/if}
		</span>
		{@render content()}
	</div>
{/snippet}

<!-- Clicking a header sorts by it and clicking again flips direction, as on app.viam.com. -->
{#snippet sortHeader(property: MachineSortProperty, label: string, icon: string)}
	{@const isActive = sort.current.property === property}
	{@const isDescending = isActive && sort.current.direction === 'descending'}
	<button
		type="button"
		aria-label="{label}, sort {isActive && !isDescending ? 'descending' : 'ascending'}"
		class="group hover:text-default focus-visible:outline-gray-9 flex items-center gap-1 py-1.5 pr-4 pl-2 focus-visible:outline-2 focus-visible:-outline-offset-2"
		onclick={() => {
			sort.current = nextMachineSort(sort.current, property)
		}}
	>
		<Icon
			{icon}
			class="text-gray-6 shrink-0"
		/>
		{label}
		<Icon
			icon={mdiChevronDown}
			class={[
				'text-gray-6 transition-transform',
				!isActive && 'invisible group-hover:visible',
				isDescending && 'rotate-180',
			]}
		/>
	</button>
{/snippet}

<section
	aria-label="Viam account"
	class={[
		'font-public-sans flex flex-col gap-2 *:shrink-0',
		session.state.status === 'active' ? 'min-h-0 flex-1' : 'shrink-0',
	]}
>
	{#if error}
		<div role="alert">
			<Banner variant="danger">
				<Banner.Description>{error}</Banner.Description>
			</Banner>
		</div>
	{/if}

	{#if session.state.status === 'restoring'}
		<div class="text-subtle-1 flex items-center gap-2 p-2 text-xs">
			<span
				class="progress-dots"
				aria-hidden="true"
			></span>
			Restoring your Viam session
		</div>
	{:else if session.state.status === 'logged-out'}
		<div class="border-medium flex items-center justify-between gap-4 rounded border p-3">
			<div class="flex flex-col gap-0.5 text-xs">
				<span class="text-heading font-medium">Connect with your Viam account</span>
				<span class="text-subtle-1">Pick any machine in your organizations.</span>
			</div>
			<button
				type="button"
				class="button button-compact button-dark"
				onclick={() => void session.login()}
			>
				Log in with Viam
			</button>
		</div>
	{:else if session.state.status === 'awaiting-approval'}
		{@const { pending } = session.state}
		<div class="border-medium flex flex-col gap-3 rounded border p-3 text-xs">
			<span class="text-heading font-medium">Finish logging in in your browser</span>
			<div class="flex items-center justify-between">
				<span class="text-default">Confirm this code matches</span>
				<span class="font-roboto-mono text-heading text-sm tracking-widest">{pending.userCode}</span
				>
			</div>
			<div class="text-subtle-1 flex items-center gap-2">
				<span
					class="progress-dots"
					aria-hidden="true"
				></span>
				<span>Waiting for approval, expires in {formatCountdown(pending.expiresAt)}</span>
			</div>
			<div class="flex justify-between">
				<button
					type="button"
					class="button button-compact button-ghost"
					onclick={() => window.open(pending.verificationUri, '_blank', 'noopener')}
				>
					Reopen login page
				</button>
				<button
					type="button"
					class="button button-compact"
					onclick={session.cancelLogin}
				>
					Cancel
				</button>
			</div>
		</div>
	{:else if session.state.status === 'expired'}
		<div class="border-medium flex items-center justify-between gap-4 rounded border p-3 text-xs">
			<div class="text-subtle-1 flex items-center gap-2">
				<span
					class="progress-dots"
					aria-hidden="true"
				></span>
				Reconnecting to your Viam account
			</div>
			<button
				type="button"
				class="button button-compact"
				onclick={session.logout}
			>
				Sign out
			</button>
		</div>
	{:else}
		{@const { session: activeSession } = session.state}
		<div class="flex items-center justify-between gap-2">
			<OrgMenu
				organizations={machines.organizations}
				currentId={machines.organizationId}
				onChange={(id) => {
					machines.organizationId = id
				}}
			/>
			<UserMenu
				displayName={activeSession.displayName}
				email={activeSession.email}
				onSignOut={session.logout}
			/>
		</div>

		<div class="flex items-center gap-2">
			<Icon
				icon={mdiMagnify}
				class="text-gray-6 shrink-0"
			/>
			<TextField
				aria-label="Search machines, parts, and locations"
				placeholder="Start typing to search…"
				class="grow"
				bind:value={filter}
			/>
		</div>

		{#if isLaunched}
			<p class="text-subtle-2 text-xs">A Viam CLI launch is active, so picking a machine is off.</p>
		{/if}

		<div class="border-light flex min-h-0 shrink! flex-col border">
			<div
				class="border-light bg-light text-subtle-1 flex shrink-0 items-center justify-between border-b text-xs"
			>
				<span class="flex flex-1 items-center">
					<span class="flex w-8 shrink-0 justify-end">
						<button
							type="button"
							aria-label="Show favorites first"
							aria-pressed={favorites.isFavoritesFirst}
							title="Show favorites first"
							class="text-gray-6 hover:text-gray-8 focus-visible:outline-gray-9 inline-flex rounded focus-visible:outline-2"
							onclick={() => {
								favorites.isFavoritesFirst = !favorites.isFavoritesFirst
							}}
						>
							<Star isFilled={favorites.isFavoritesFirst} />
						</button>
					</span>
					{@render sortHeader('name', 'Machine', mdiMultiplicationBox)}
				</span>
				{@render sortHeader('status', 'Status', mdiBroadcast)}
			</div>

			{#if machines.isLoading && machines.locations.length === 0}
				<div class="text-subtle-1 flex items-center gap-2 px-4 py-3 text-xs">
					<span
						class="progress-dots"
						aria-hidden="true"
					></span>
					Loading machines
				</div>
			{:else if items.length === 0}
				<p class="text-subtle-1 px-4 py-3 text-center text-xs">
					{filter ? 'No results found' : 'This organization has no machines.'}
				</p>
			{:else}
				<VirtualList
					{items}
					class="min-h-0"
					style="height: {contentHeight}px"
					sizingCalculator={(index) => machineListItemHeight(items[index])}
				>
					{#snippet vl_slot({ item })}
						{#if item.kind === 'machine'}
							{#snippet label(isPicked: boolean)}
								{@render machineName(item.row.machine.machineName, item.row.locationName, isPicked)}
							{/snippet}
							{@render pickButton(item.row.machine, item.part, 'h-11', true, label)}
						{:else if item.kind === 'machine-heading'}
							{#snippet heading()}
								<div class="text-subtle-1 flex min-w-0 flex-1 items-center pr-4 pl-2">
									{@render machineName(item.row.machine.machineName, item.row.locationName, false)}
								</div>
							{/snippet}
							{@render listRow('h-11', item.row.machine, false, heading)}
						{:else}
							{#snippet label(isPicked: boolean)}
								<span
									class="border-light ml-1 flex h-full min-w-0 items-center gap-1.5 self-stretch border-l pl-3"
								>
									<span class={['truncate text-sm', isPicked && 'text-heading font-medium']}
										>{item.part.partName}</span
									>
									{#if item.part.isMainPart}
										<span
											class="border-light bg-light text-subtle-1 rounded border px-1.5 py-0.5 font-mono text-[11px] tracking-wider uppercase"
											>Main</span
										>
									{/if}
								</span>
							{/snippet}
							{@render pickButton(item.row.machine, item.part, 'h-8', false, label)}
						{/if}
					{/snippet}
				</VirtualList>
			{/if}
		</div>
	{/if}
</section>

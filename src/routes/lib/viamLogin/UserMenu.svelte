<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'

	import Popover from '#lib/components/overlay/Popover.svelte'

	interface Props {
		displayName: string
		email: string
		onSignOut: () => void
	}

	const { displayName, email, onSignOut }: Props = $props()

	const USER_SETTINGS_URL = 'https://app.viam.com/user/settings'

	// Same rule as app.viam.com: the first letter of each word in the display name. With no name
	// claims, the email's first letter stands in.
	const initials = $derived(
		displayName
			? displayName
					.split(' ')
					.map((word) => word[0] ?? '')
					.join('')
			: (email[0]?.toUpperCase() ?? '')
	)
</script>

<!-- Modeled on app.viam.com's nav user menu. -->
<Popover placement="bottom-end">
	{#snippet trigger(triggerProps, { isOpen })}
		<button
			{...triggerProps}
			aria-label="User menu"
			class={[
				'text-default flex h-8 shrink-0 items-center px-2 text-sm font-medium whitespace-nowrap',
				'focus-visible:outline-gray-9 focus-visible:outline-2',
				isOpen ? 'bg-ghost-light' : 'hover:bg-ghost-light',
			]}
		>
			{#if initials}
				{initials}
			{:else}
				<Icon name="logout" />
			{/if}
		</button>
	{/snippet}

	{#snippet children({ close })}
		<div class="font-public-sans text-default flex w-80 flex-col">
			<div class="border-b-light border-b p-4">
				{#if displayName}
					<h2 class="text-default text-base font-semibold">{displayName}</h2>
				{/if}
				{#if email}
					<small class="text-subtle-2 text-sm">{email}</small>
				{/if}
			</div>
			<div class="py-2">
				<button
					type="button"
					class="hover:bg-medium focus-visible:outline-gray-9 flex h-10 w-full items-center gap-1.5 px-4 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2"
					onclick={() => {
						close()
						window.open(USER_SETTINGS_URL, '_blank', 'noopener')
					}}
				>
					<span class="text-gray-6"><Icon name="cog" /></span>
					Settings
				</button>
				<button
					type="button"
					class="hover:bg-medium focus-visible:outline-gray-9 flex h-10 w-full items-center gap-1.5 px-4 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2"
					onclick={() => {
						close()
						onSignOut()
					}}
				>
					<span class="text-gray-6"><Icon name="logout" /></span>
					Sign out
				</button>
			</div>
		</div>
	{/snippet}
</Popover>

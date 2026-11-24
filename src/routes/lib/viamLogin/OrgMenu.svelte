<script lang="ts">
	import type { appApi } from '@viamrobotics/sdk'

	import { mdiChevronDown } from '@mdi/js'
	import { Icon } from '@viamrobotics/prime-ui'

	import Popover from '#lib/components/overlay/Popover.svelte'

	interface Props {
		organizations: appApi.Organization[]
		currentId: string
		onChange: (id: string) => void
	}

	const { organizations, currentId, onChange }: Props = $props()

	const currentName = $derived(organizations.find(({ id }) => id === currentId)?.name ?? '')
	const sortedOrganizations = $derived(
		organizations.toSorted((a, b) =>
			a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
		)
	)
</script>

<!-- Modeled on app.viam.com's nav org menu, without its settings, billing, and create links. -->
<Popover placement="bottom-start">
	{#snippet trigger(triggerProps, { isOpen })}
		<button
			{...triggerProps}
			aria-label="Current organization"
			class={[
				'text-default flex h-8 min-w-0 items-center gap-1.5 px-2 text-sm font-medium whitespace-nowrap',
				'focus-visible:outline-gray-9 focus-visible:outline-2',
				isOpen ? 'bg-ghost-light' : 'hover:bg-ghost-light',
			]}
		>
			<span class="truncate">{currentName || 'Select organization'}</span>
			<Icon
				icon={mdiChevronDown}
				class={['text-gray-7 shrink-0 transition duration-200', isOpen && 'rotate-180']}
			/>
		</button>
	{/snippet}

	{#snippet children({ close })}
		<div class="font-public-sans text-default flex w-80 flex-col">
			<section>
				<ul
					class="text-subtle-1 py-2 text-sm"
					aria-label="Organizations"
				>
					{#each sortedOrganizations as organization (organization.id)}
						<li>
							<button
								type="button"
								aria-current={organization.id === currentId || undefined}
								class={[
									'w-full px-4 py-1.5 text-left',
									'focus-visible:outline-gray-9 focus-visible:outline-2 focus-visible:-outline-offset-2',
									// Matches a selected WorldTree row.
									organization.id === currentId
										? 'bg-medium text-heading font-medium'
										: 'hover:bg-light',
								]}
								onclick={() => {
									close()
									if (organization.id !== currentId) onChange(organization.id)
								}}
							>
								{organization.name}
							</button>
						</li>
					{/each}
				</ul>
			</section>
		</div>
	{/snippet}
</Popover>

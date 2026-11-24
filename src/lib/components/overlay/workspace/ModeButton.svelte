<script
	module
	lang="ts"
>
	import type { EnvironmentMode } from '#lib/hooks/useEnvironment.svelte.js'

	const appearance = {
		monitor: {
			label: 'Monitor',
			idle: 'text-gray-8',
			border: 'border-info-medium',
			fill: 'bg-info-light text-info-dark',
		},
		build: {
			label: 'Build',
			idle: 'text-gray-8',
			border: 'border-info-medium',
			fill: 'bg-info-light text-info-dark',
		},
		move: {
			label: 'Move',
			idle: 'text-gray-8',
			border: 'border-info-medium',
			fill: 'bg-info-light text-info-dark',
		},
		replay: {
			label: 'Replay',
			idle: 'text-gray-8',
			border: 'border-info-medium',
			fill: 'bg-info-light text-info-dark',
		},
	} as const satisfies Record<
		EnvironmentMode,
		{ label: string; idle: string; border: string; fill: string }
	>
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements'

	import { mdiEyeOutline, mdiPlayCircleOutline } from '@mdi/js'
	import { Dialog, Icon, Tooltip } from '@viamrobotics/prime-ui'
	import { Hammer, Move3d } from 'lucide-svelte'

	import { type LeaveConfirmation, useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'

	interface Props {
		/** The mode this button switches the app into. */
		mode: EnvironmentMode
		description: string
		class?: ClassValue
	}

	const { mode, description, class: className }: Props = $props()

	const environment = useEnvironment()

	let confirmOpen = $state(false)
	let confirmation = $state.raw<LeaveConfirmation>()

	const style = $derived(appearance[mode])
	const isSelected = $derived(environment.current.mode === mode)

	// The mode being left decides whether leaving loses anything, so it is asked before switching.
	const request = () => {
		if (isSelected) return

		confirmation = environment.leaveConfirmation()
		if (confirmation) {
			confirmOpen = true
			return
		}

		environment.current.mode = mode
	}

	const discardAndSwitch = () => {
		confirmation?.discard()
		environment.current.mode = mode
		confirmOpen = false
	}
</script>

<Tooltip>
	<Tooltip.Trigger>
		<label
			class={[
				className,
				'relative block rounded-md border bg-white',
				isSelected ? ['z-4', style.border] : 'border-gray-5 hover:bg-light active:bg-medium',
			]}
		>
			<button
				class={['flex items-center rounded-[inherit] p-1.5', isSelected ? style.fill : style.idle]}
				role="radio"
				aria-label={description}
				aria-checked={isSelected}
				onclick={request}
			>
				{#if mode === 'monitor'}
					<Icon icon={mdiEyeOutline} />
				{:else if mode === 'build'}
					<Hammer size="16" />
				{:else if mode === 'replay'}
					<Icon icon={mdiPlayCircleOutline} />
				{:else if mode === 'move'}
					<Move3d size="16" />
				{/if}

				<span
					class="font-public-sans grid text-xs font-medium transition-[grid-template-columns] duration-150 ease-out motion-reduce:transition-none"
					style:grid-template-columns={isSelected ? '1fr' : '0fr'}
					aria-hidden="true"
				>
					<span class="overflow-hidden">
						<span class="block pl-1.5 whitespace-nowrap">{style.label}</span>
					</span>
				</span>
			</button>
		</label>
	</Tooltip.Trigger>
	<Tooltip.Content side="bottom">{description}</Tooltip.Content>
</Tooltip>

<Dialog bind:open={confirmOpen}>
	<Dialog.Content class="w-full max-w-sm gap-3">
		<Dialog.Title>Discard unsaved changes?</Dialog.Title>
		<Dialog.Description>{confirmation?.description}</Dialog.Description>

		<div class="mt-1 flex justify-end gap-2">
			<Dialog.Close class="button button-compact">Cancel</Dialog.Close>
			<button
				type="button"
				class="button button-compact button-dark"
				onclick={discardAndSwitch}
			>
				Discard
			</button>
		</div>
	</Dialog.Content>
</Dialog>

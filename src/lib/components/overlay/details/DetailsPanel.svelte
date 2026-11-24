<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	import { mdiTrashCanOutline } from '@mdi/js'
	import { draggable } from '@neodrag/svelte'
	import { Portal } from '@threlte/extras/webgpu'
	import { Icon, Tooltip, useToast } from '@viamrobotics/prime-ui'
	import { type Entity } from 'koota'
	import { Check, Copy } from 'lucide-svelte'

	import { traits, useMappedEntitiesTraits, useWorld } from '#lib/ecs/index.js'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { useResourceByName } from '#lib/hooks/useResourceByName.svelte.js'

	import { detailsClipboardText } from './detailsClipboardText'
	import { MIXED, sharedValue } from './sharedValue'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** The selection the panel describes. Never empty. */
		entities: readonly Entity[]
		/** The mode's details, rendered under the shared header. They paint their own background. */
		children: Snippet
		/**
		 * Header actions that read a scene object: copy its pose.
		 * Turn off for a row that only exists in the config.
		 */
		sceneActions?: boolean
	}

	const { entities, children, sceneActions = true, ...rest }: Props = $props()

	const world = useWorld()
	const resourceByName = useResourceByName()
	const environment = useEnvironment()
	const toast = useToast()

	const headers = useMappedEntitiesTraits(
		() => entities,
		[traits.Name, traits.FramesAPI, traits.Removable],
		(entity) => {
			const name = entity.get(traits.Name)
			return {
				name,
				// Only a frame names a resource, so only a frame shows its subtype.
				subtype: entity.has(traits.FramesAPI)
					? (name ? resourceByName.current[name] : undefined)?.subtype
					: '',
				isRemovable: entity.has(traits.Removable),
			}
		}
	)

	const isSingle = $derived(entities.length === 1)
	const title = $derived(isSingle ? headers.current[0]?.name : `${entities.length} selected`)
	const subtype = $derived(sharedValue(headers.current.map((header) => header.subtype)))
	const isRemovable = $derived(headers.current.every((header) => header.isRemovable))

	/** How long the copy button shows its check mark after a copy. */
	const COPIED_FEEDBACK_MS = 1000

	let copied = $state(false)
	let dragElement = $state.raw<HTMLElement>()

	const stopKeyboardPropagation = (event: KeyboardEvent) => {
		event.stopPropagation()
	}
</script>

{#if !environment.current.isImmersive}
	<Portal id="dom">
		<!-- tabindex makes the whole panel focusable so a click anywhere in it (not
just the inputs) raises it via `focus-within:z-5`. -->
		<div
			id="details-panel"
			class="border-medium absolute top-10 right-0 z-4 m-2 w-70 border text-xs focus-within:z-5"
			role="region"
			aria-label="Details panel"
			tabindex="-1"
			onkeydown={stopKeyboardPropagation}
			onkeyup={stopKeyboardPropagation}
			use:draggable={{
				bounds: 'body',
				handle: dragElement,
			}}
			{...rest}
		>
			<div
				class="bg-extralight flex cursor-move items-center justify-between gap-2 p-2"
				bind:this={dragElement}
			>
				<div class="flex w-[90%] items-center gap-1">
					<strong class="overflow-hidden text-nowrap text-ellipsis">{title}</strong>
					{#if subtype !== MIXED}
						<span class="text-subtle-2">{subtype}</span>
					{/if}
				</div>

				{#if sceneActions}
					<Tooltip>
						<Tooltip.Trigger>
							<button
								class="text-subtle-2"
								aria-label="Copy details to clipboard"
								onclick={async () => {
									try {
										await navigator.clipboard.writeText(detailsClipboardText(entities))
									} catch {
										// Clipboard unavailable: non-secure context or permission denied.
										toast.danger("Couldn't copy to clipboard")
										return
									}
									copied = true
									setTimeout(() => (copied = false), COPIED_FEEDBACK_MS)
								}}
							>
								{#if copied}
									<Check size={14} />
								{:else}
									<Copy size={14} />
								{/if}
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content placement="bottom">Copy details to clipboard</Tooltip.Content>
					</Tooltip>
				{/if}

				{#if isRemovable}
					<Tooltip>
						<Tooltip.Trigger>
							<button
								class="text-subtle-2 hover:text-danger-dark"
								aria-label="Remove from scene"
								onclick={() => {
									for (const entity of entities) {
										if (world.has(entity)) entity.destroy()
									}
								}}
							>
								<Icon icon={mdiTrashCanOutline} />
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content placement="bottom">Remove from scene</Tooltip.Content>
					</Tooltip>
				{/if}
			</div>

			<div class="border-medium border-b"></div>

			{@render children()}
		</div>
	</Portal>
{/if}

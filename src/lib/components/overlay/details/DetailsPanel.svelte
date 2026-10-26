<script
	module
	lang="ts"
>
	import { MathUtils } from 'three'
</script>

<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	import { draggable } from '@neodrag/svelte'
	import { Portal } from '@threlte/extras'
	import { Icon } from '@viamrobotics/prime-core'
	import { type Entity } from 'koota'
	import { Check, Copy } from 'lucide-svelte'

	import { traits, useParentName, useTrait, useWorld } from '$lib/ecs'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useResourceByName } from '$lib/hooks/useResourceByName.svelte'

	import Tooltip from '../Tooltip.svelte'
	import { composeDisplayedPose } from './composeDisplayedPose'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		entity: Entity
		/** The mode's details, rendered under the shared header. They paint their own background. */
		children: Snippet
		/**
		 * Header actions that read a scene object: copy its pose.
		 * Turn off for a row that only exists in the config.
		 */
		sceneActions?: boolean
	}

	const { entity, children, sceneActions = true, ...rest }: Props = $props()

	const world = useWorld()
	const resourceByName = useResourceByName()
	const environment = useEnvironment()

	const name = useTrait(() => entity, traits.Name)
	const parent = useParentName(() => entity)
	const matrix = useTrait(() => entity, traits.Matrix)
	const editedMatrix = useTrait(() => entity, traits.EditedMatrix)
	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const center = useTrait(() => entity, traits.Center)
	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)
	const cylinder = useTrait(() => entity, traits.Cylinder)
	const removable = useTrait(() => entity, traits.Removable)
	const framesAPI = useTrait(() => entity, traits.FramesAPI)

	const isFrameNode = $derived(!!framesAPI.current)
	const geometryCenter = $derived(isFrameNode ? undefined : center.current)

	const localPose = $derived(
		composeDisplayedPose(editedMatrix.current ?? matrix.current, geometryCenter)
	)
	const worldPose = $derived(
		worldMatrix.current ? composeDisplayedPose(worldMatrix.current, geometryCenter) : undefined
	)
	const resourceName = $derived(name.current ? resourceByName.current[name.current] : undefined)
	const displayType = $derived(isFrameNode ? resourceName?.subtype : '')

	const geometryType = $derived.by(() => {
		if (box.current) return 'box'
		if (sphere.current) return 'sphere'
		if (capsule.current) return 'capsule'
		if (cylinder.current) return 'cylinder'
		return 'none'
	})

	let copied = $state(false)
	let dragElement = $state.raw<HTMLElement>()

	const stopKeyboardPropagation = (event: KeyboardEvent) => {
		event.stopPropagation()
	}

	const getCopyClipboardText = () => {
		return JSON.stringify(
			{
				worldPosition: worldPose ? { x: worldPose.x, y: worldPose.y, z: worldPose.z } : null,
				worldOrientation: worldPose
					? {
							x: worldPose.oX,
							y: worldPose.oY,
							z: worldPose.oZ,
							th: MathUtils.degToRad(worldPose.theta),
						}
					: null,
				localPosition: {
					x: localPose?.x,
					y: localPose?.y,
					z: localPose?.z,
				},
				localOrientation: {
					x: localPose?.oX,
					y: localPose?.oY,
					z: localPose?.oZ,
					th: localPose?.theta,
				},
				geometry: {
					type: geometryType,
					value: box.current ?? capsule.current ?? cylinder.current ?? sphere.current,
				},
				parentFrame: parent.current ?? 'world',
			},
			null,
			2
		)
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
					<strong class="overflow-hidden text-nowrap text-ellipsis">{name.current}</strong>
					<span class="text-subtle-2">{displayType}</span>
				</div>

				{#if removable.current}
					<Tooltip placement="bottom">
						{#snippet children(tooltipID)}
							<button
								class="text-subtle-2"
								aria-describedby={tooltipID}
								onclick={() => {
									if (world.has(entity)) {
										entity.destroy()
									}
								}}
							>
								<Icon name="trash-can-outline" />
							</button>
						{/snippet}

						{#snippet content()}Remove from scene{/snippet}
					</Tooltip>
				{/if}

				{#if sceneActions}
					<Tooltip placement="bottom">
						{#snippet children(tooltipID)}
							<button
								class="text-subtle-2"
								aria-describedby={tooltipID}
								onclick={async () => {
									try {
										await navigator.clipboard.writeText(getCopyClipboardText())
									} catch {
										// clipboard unavailable (non-secure context or permission denied)
									}
									copied = true
									setTimeout(() => (copied = false), 1000)
								}}
							>
								{#if copied}
									<Check size={14} />
								{:else}
									<Copy size={14} />
								{/if}
							</button>
						{/snippet}

						{#snippet content()}Copy details to clipboard{/snippet}
					</Tooltip>
				{/if}
			</div>

			<div class="border-medium border-b"></div>

			{@render children()}
		</div>
	</Portal>
{/if}

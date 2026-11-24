<script lang="ts">
	import type { Entity } from 'koota'
	import type { HTMLAttributes } from 'svelte/elements'
	import type { Matrix4 } from 'three'

	import { Select, Tabs } from '@viamrobotics/prime-controls'
	import { useToast } from '@viamrobotics/prime-ui'
	import { MotionClient } from '@viamrobotics/sdk'
	import { createResourceClient, useResourceStatuses } from '@viamrobotics/svelte-sdk'
	import { PersistedState } from 'runed'

	import type { DetailsTab } from '#lib/components/overlay/details/DetailsTabs.svelte'
	import type { Pose, PosePatch } from '#lib/math/index.js'

	import DetailsPanel from '#lib/components/overlay/details/DetailsPanel.svelte'
	import DetailsTabs from '#lib/components/overlay/details/DetailsTabs.svelte'
	import {
		DEFAULT_ORIENTATION_FORMAT,
		ORIENTATION_FORMAT_KEY,
		type OrientationFormat,
	} from '#lib/components/overlay/details/orientationFormat.js'
	import SharedNumberFields from '#lib/components/overlay/details/SharedNumberFields.svelte'
	import { useArmClient } from '#lib/hooks/useArmClient.svelte.js'
	import { useFrames } from '#lib/hooks/useFrames.svelte.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { setOrientationFromEuler } from '#lib/math/transform.js'
	import { executeCommand } from '#lib/motion/planDoCommand.js'

	import Collisions from './collisions/Collisions.svelte'
	import { defaultMotionService, motionServiceNames } from './moveControls'
	import { moveExecutionOwner } from './moveExecutionOwner.svelte'
	import MoveGizmo from './MoveGizmo.svelte'
	import { moveGizmoOptions } from './moveGizmoOptions.svelte'
	import { moveGizmoOwner } from './moveGizmoOwner.svelte'
	import MoveJsonField from './MoveJsonField.svelte'
	import MovePreview from './MovePreview.svelte'
	import MoveTargetGhost from './MoveTargetGhost.svelte'
	import { fromDestinationPose, moveDelta, toDestinationPose } from './moveTargetPose'
	import { parseMoveOptions } from './parseMoveOptions'
	import SavePoseButton from './savedPoses/SavePoseButton.svelte'
	import StopMoveButton from './StopMoveButton.svelte'
	import { useMovedFrameMatrix } from './useMovedFrameMatrix.svelte'
	import { useMoveGhosts } from './useMoveGhosts.svelte'
	import { usePreviewMove } from './usePreviewMove.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** The selected frame this panel is the details for. */
		entity: Entity
		frameName: string
	}

	const { entity, frameName, ...rest }: Props = $props()

	/** The gizmo is dragged in world space, so the goal is committed against it. */
	const WORLD_FRAME = 'world'

	const id = $props.id()
	const targetHeadingId = `${id}-target`

	const frames = useFrames()
	const armClient = useArmClient()
	const partID = usePartID()
	const toast = useToast()
	const motionResources = useResourceStatuses(() => partID.current, 'motion')

	const motionServices = $derived(
		motionServiceNames(
			motionResources.current.map((resource) => resource.name).filter((name) => name !== undefined)
		)
	)
	const defaultService = $derived(defaultMotionService(motionServices))

	let selectedService = $state<string>()
	const service = $derived(selectedService ?? defaultService)

	const motion = createResourceClient(
		MotionClient,
		() => partID.current,
		() => service
	)

	// Hand-written JSON is expensive to retype, and the panel unmounts with the
	// selection, so keep each frame's fields across mounts and reloads. The
	// `motion-tools:` prefix predates the rename to visualization and is kept so
	// existing users don't lose saved input.
	const worldStateJson = $derived(
		new PersistedState(`motion-tools:move-world-state:${partID.current}:${frameName}`, '')
	)
	const constraintsJson = $derived(
		new PersistedState(`motion-tools:move-constraints:${partID.current}:${frameName}`, '')
	)

	/** This panel's own move is running, so it shows progress rather than disabling outright. */
	const executing = $derived(moveExecutionOwner.movingFrame === frameName)

	/** Another panel is already driving the machine; see `moveExecutionOwner` for why that matters. */
	const otherPanelMoving = $derived(
		moveExecutionOwner.movingFrame !== undefined && moveExecutionOwner.movingFrame !== frameName
	)

	/**
	 * A resource *name* is not a client: names come from cache, while `createResourceClient` yields
	 * `undefined` until the connection is `CONNECTED`, so `service` can be set when `motion` is not.
	 */
	const canCommand = $derived(motion.current !== undefined && service !== undefined)

	/**
	 * The staged goal in world space, or `undefined` while the gizmo still tracks
	 * the frame. Raw because it is a Three.js instance replaced wholesale on every
	 * drag frame.
	 */
	let targetWorldMatrix = $state.raw<Matrix4>()

	/**
	 * The end effector, not the `<name>_origin` mount the scene draws the
	 * component at — that is the frame the motion service moves, so it is the
	 * frame the handle belongs on. Resolved in world space.
	 */
	const currentWorldMatrix = useMovedFrameMatrix(
		() => partID.current,
		() => frameName,
		() => true
	)

	// The handle is live for as long as the panel is. Claim the single gizmo slot
	// so only one open panel drags at a time.
	$effect(() => {
		moveGizmoOwner.arm(frameName)
		return () => moveGizmoOwner.disarm(frameName)
	})

	const armed = $derived(moveGizmoOwner.armedFrame === frameName)

	/** Another open panel took the gizmo out from under this one. */
	const preempted = $derived(!armed)

	const showGizmo = $derived(armed && !executing && currentWorldMatrix.current !== undefined)

	/** Whether the handle has been dragged off the frame's live pose. */
	const staged = $derived(targetWorldMatrix !== undefined)

	/**
	 * What the readout describes: the staged goal once dragged, otherwise where
	 * the frame is right now. The panel shows the same rows either way, so the
	 * numbers are readable before the first drag rather than appearing with it.
	 */
	const readoutMatrix = $derived(targetWorldMatrix ?? currentWorldMatrix.current)

	// The handle is placed and dragged in world space, so the goal is expressed in
	// world too — no `<name>_origin` round-trip between what is dragged and what
	// is committed.
	const targetPose = $derived(readoutMatrix ? toDestinationPose(readoutMatrix) : undefined)

	const delta = $derived(
		readoutMatrix && currentWorldMatrix.current
			? moveDelta(currentWorldMatrix.current, readoutMatrix)
			: undefined
	)

	const orientationFormat = new PersistedState<OrientationFormat>(
		ORIENTATION_FORMAT_KEY,
		DEFAULT_ORIENTATION_FORMAT
	)

	/** The orientation as Euler angles (deg), for the Euler rotation tab. */
	const eulerValue = $derived.by(() => {
		if (!targetPose) return { roll: 0, pitch: 0, yaw: 0 }
		return targetPose.toEulerDegrees()
	})

	const POSITION_FIELDS = [
		{ key: 'x', label: 'X' },
		{ key: 'y', label: 'Y' },
		{ key: 'z', label: 'Z' },
	] as const
	const ORIENTATION_FIELDS = [
		{ key: 'oX', label: 'X' },
		{ key: 'oY', label: 'Y' },
		{ key: 'oZ', label: 'Z' },
		{ key: 'theta', label: 'Th' },
	] as const
	const EULER_FIELDS = [
		{ key: 'roll', label: 'X' },
		{ key: 'pitch', label: 'Y' },
		{ key: 'yaw', label: 'Z' },
	] as const

	/** Numbers render as an em dash until the frame's pose has resolved. */
	const num = (value: number | undefined, digits: number) => value?.toFixed(digits) ?? '—'

	// Ghosts are entities, drawn by the scene's own renderers — see `moveGhosts`.
	// The subtree rides the delta between these two matrices, which the hook
	// composes itself so a live gizmo isn't allocating one per frame.
	useMoveGhosts(
		() => (armed ? entity : undefined),
		() => currentWorldMatrix.current,
		() => targetWorldMatrix
	)

	/**
	 * Stage an edited pose as the goal. Typing into a field before the first drag
	 * stages the frame's current pose with that one value changed, so the inputs
	 * and the gizmo are two views of the same goal.
	 */
	const stagePose = (pose: Pose) => (targetWorldMatrix = fromDestinationPose(pose))

	const stagePosePatch = (patch: PosePatch) => {
		if (targetPose) stagePose(targetPose.clone().merge(patch))
	}

	const stageEulerPatch = (patch: Partial<Record<'roll' | 'pitch' | 'yaw', number>>) => {
		if (!targetPose) return
		const pose = targetPose.clone()
		setOrientationFromEuler(targetPose, patch, pose)
		stagePose(pose)
	}

	const preview = usePreviewMove({
		frames,
		client: () => motion.current,
		service: () => service,
		frameName: () => frameName,
		destination: () => (targetPose ? { referenceFrame: WORLD_FRAME, pose: targetPose } : undefined),
		moveOptions: () => parseMoveOptions(worldStateJson.current, constraintsJson.current),
		invalidateOn: () => [
			targetWorldMatrix,
			worldStateJson.current,
			constraintsJson.current,
			service,
			// `useFrames` refetches on every config revision, and kinematics that changed underneath a
			// drawn plan put the twins somewhere the machine never was.
			frames.parts,
		],
	})

	const moveDisabled = $derived(!staged || executing || otherPanelMoving || !canCommand)
	const executePlanDisabled = $derived(
		preview.status !== 'ready' || executing || otherPanelMoving || !canCommand
	)
	const resetDisabled = $derived(!staged || executing)

	/**
	 * Two ways to the same staged target, one action each: `Move` plans and runs server-side, and
	 * Preview draws a trajectory before running exactly that.
	 */
	const tabs = $derived<DetailsTab[]>([
		{ id: 'move', label: 'Move', content: moveTab },
		{
			id: 'preview',
			label: 'Preview',
			content: previewTab,
			indicatorLabel: preview.status === 'ready' ? 'preview ready' : undefined,
		},
	])

	/** Drop the staged goal so the gizmo snaps back to wherever the frame is now. */
	const resetTarget = () => {
		targetWorldMatrix = undefined
		preview.clear()
	}

	/**
	 * Runs the trajectory the preview drew, exactly as drawn. `execute` does not replan, which is
	 * the point: the preview is what is being approved.
	 */
	const executePreviewedMove = async () => {
		const client = motion.current
		if (!client || preview.status !== 'ready') return
		if (!moveExecutionOwner.claim(frameName)) return

		try {
			// `execute` answers `{execute: true}` or errors; there is no partial-success reply to read.
			await client.doCommand(executeCommand(preview.trajectory))
			toast.success(`Moved "${frameName}" along the previewed plan.`)
			resetTarget()
		} catch (error) {
			toast.danger(
				error instanceof Error ? error.message : `Failed to execute the plan for "${frameName}".`
			)
			// A failed `execute` is not a move that never happened: RDK batches the waypoints to the
			// component, which can stop anywhere along them, so the plan no longer starts where the
			// machine is.
			preview.clear()
		} finally {
			moveExecutionOwner.release(frameName)
		}
	}

	const executeMove = async () => {
		const client = motion.current
		if (!client || !targetPose || !service || !staged) return
		if (!moveExecutionOwner.claim(frameName)) return

		// Clearing before rather than after also cancels a plan still in flight, which would otherwise
		// land and describe a configuration the machine has already left.
		preview.clear()
		try {
			const { worldState, constraints } = parseMoveOptions(
				worldStateJson.current,
				constraintsJson.current
			)
			const success = await client.move(
				{ referenceFrame: WORLD_FRAME, pose: targetPose },
				frameName,
				worldState,
				constraints
			)
			if (success) {
				toast.success(`Moved "${frameName}" to the target.`)
				resetTarget()
			} else {
				toast.warning(`Move for "${frameName}" did not complete.`)
			}
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : `Failed to move "${frameName}".`)
		} finally {
			moveExecutionOwner.release(frameName)
		}
	}
</script>

{#snippet travel()}
	<div>
		<strong class="font-semibold">travel</strong>
		<div class="mt-0.5">
			{num(delta?.distance, 1)} mm · {num(delta?.angle, 1)}°
		</div>
	</div>
{/snippet}

{#snippet moveTab()}
	<div class="flex flex-col gap-4 pt-3">{@render moveTabContent()}</div>
{/snippet}

{#snippet moveTabContent()}
	{#if preempted}
		<div class="border-light flex items-center justify-between gap-2 border px-2 py-1.5">
			<p class="text-subtle-1">Another move panel has the gizmo.</p>
			<button
				type="button"
				class="button button-compact button-ghost"
				onclick={() => moveGizmoOwner.arm(frameName)}
			>
				Use it here
			</button>
		</div>
	{/if}

	<section
		class="flex flex-col gap-2"
		aria-labelledby={targetHeadingId}
	>
		<div class="flex items-center justify-between">
			<h4
				id={targetHeadingId}
				class="text-subtle-2"
			>
				Target
			</h4>
			<button
				type="button"
				class="button button-compact button-ghost"
				aria-disabled={resetDisabled || undefined}
				title="Put the target back where the frame is"
				onclick={() => {
					if (!resetDisabled) resetTarget()
				}}
			>
				Reset
			</button>
		</div>

		{#if targetPose}
			<div>
				<strong class="font-semibold">world position</strong>
				<span class="text-subtle-2">(mm)</span>

				<SharedNumberFields
					aria-label="move target position (mm)"
					fields={POSITION_FIELDS}
					values={{ x: targetPose.x, y: targetPose.y, z: targetPose.z }}
					disabled={executing}
					onchange={stagePosePatch}
				/>
			</div>

			<div>
				<strong class="font-semibold">world orientation</strong>

				<Tabs
					bind:value={
						() => orientationFormat.current,
						(next) => (orientationFormat.current = next as OrientationFormat)
					}
				>
					<Tabs.List aria-label="move target orientation format">
						<Tabs.Trigger value="ov">OV (deg)</Tabs.Trigger>
						<Tabs.Trigger value="euler">Euler (deg)</Tabs.Trigger>
					</Tabs.List>
					<Tabs.Content value="ov">
						<SharedNumberFields
							aria-label="move target orientation (OV, deg)"
							fields={ORIENTATION_FIELDS}
							values={{
								oX: targetPose.oX,
								oY: targetPose.oY,
								oZ: targetPose.oZ,
								theta: targetPose.theta,
							}}
							disabled={executing}
							onchange={stagePosePatch}
						/>
					</Tabs.Content>
					<Tabs.Content value="euler">
						<SharedNumberFields
							aria-label="move target orientation (Euler, deg)"
							fields={EULER_FIELDS}
							values={eulerValue}
							disabled={executing}
							onchange={stageEulerPatch}
						/>
					</Tabs.Content>
				</Tabs>
			</div>
		{:else}
			<p class="text-subtle-2">Resolving the frame's pose…</p>
		{/if}

		{@render travel()}
	</section>

	<Collisions />

	<!--
		Last and apart, because Move drives hardware. Save current pose sits at the far end, so it
		does not read as saving the staged target Move is about to go to. Both stay mounted when
		disabled, so nothing shifts under the cursor or drops keyboard focus.
	-->
	<div class="border-light flex items-center justify-between gap-2 border-t pt-3">
		<!--
			`Move` rather than a label naming a plan: this calls the motion service's `Move`, which plans
			server-side and never sees a plan on screen.
		-->
		<button
			type="button"
			class="button button-compact button-success"
			aria-disabled={moveDisabled || undefined}
			aria-busy={executing || undefined}
			title="Ask the motion service to plan and move"
			onclick={() => {
				if (!moveDisabled) void executeMove()
			}}
		>
			{#if executing}
				<span
					class="progress-dots"
					aria-hidden="true"
				></span>
			{/if}
			Move
		</button>
		<StopMoveButton
			arm={frameName}
			isMoving={executing}
		/>
		{#if armClient.names.includes(frameName)}
			<SavePoseButton
				arm={frameName}
				hasStagedMove={staged}
			/>
		{/if}
	</div>
{/snippet}

{#snippet previewTab()}
	<div class="flex flex-col gap-4 pt-3">
		{@render travel()}

		<MovePreview
			{preview}
			{frameName}
			disabled={moveDisabled}
		/>

		<Collisions />

		<div class="border-light flex items-center gap-2 border-t pt-3">
			<button
				type="button"
				class="button button-compact button-success"
				aria-disabled={executePlanDisabled || undefined}
				aria-busy={executing || undefined}
				title="Run the trajectory shown above, without planning again"
				onclick={() => {
					if (!executePlanDisabled) void executePreviewedMove()
				}}
			>
				{#if executing}
					<span
						class="progress-dots"
						aria-hidden="true"
					></span>
				{/if}
				Execute plan
			</button>
			<StopMoveButton
				arm={frameName}
				isMoving={executing}
			/>
		</div>
	</div>
{/snippet}

<DetailsPanel
	entities={[entity]}
	{...rest}
>
	<div class="bg-extralight px-2 pt-3 pb-2">
		<div class="flex flex-col gap-4">
			{#if service}
				<div>
					<strong class="font-semibold">motion service</strong>
					<Select
						items={motionServices.map((name) => ({ value: name, label: name }))}
						bind:value={() => service, (next) => (selectedService = next)}
					>
						<Select.Trigger
							aria-label="motion service"
							class="w-full"
						>
							<Select.Value />
						</Select.Trigger>
						<Select.Content>
							<Select.Viewport>
								<Select.Items />
							</Select.Viewport>
						</Select.Content>
					</Select>
				</div>
			{:else}
				<p class="text-subtle-2">No motion service available.</p>
			{/if}

			<!-- Options for the motion service, so both tabs send them. -->
			<div class="flex flex-col gap-1">
				<MoveJsonField
					label="World state"
					value={worldStateJson.current}
					onChange={(next) => (worldStateJson.current = next)}
				/>
				<MoveJsonField
					label="Constraints"
					value={constraintsJson.current}
					onChange={(next) => (constraintsJson.current = next)}
				/>
			</div>
		</div>
	</div>

	<DetailsTabs
		items={tabs}
		storageKey={`motion-tools:move-tab:${partID.current}:${frameName}`}
	/>
</DetailsPanel>

{#if showGizmo && currentWorldMatrix.current}
	<MoveGizmo
		currentWorldMatrix={currentWorldMatrix.current}
		{targetWorldMatrix}
		mode={moveGizmoOptions.mode}
		space={moveGizmoOptions.space}
		onDrag={(matrix: Matrix4) => (targetWorldMatrix = matrix)}
	/>
{/if}

{#if armed && targetWorldMatrix && currentWorldMatrix.current}
	<MoveTargetGhost
		currentWorldMatrix={currentWorldMatrix.current}
		{targetWorldMatrix}
	/>
{/if}

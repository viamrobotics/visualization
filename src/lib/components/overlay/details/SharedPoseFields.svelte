<!--
@component

The local position and orientation of one or more poses. A value that differs across them shows as a dash, and an edit reaches each pose as only the fields it changes.
-->
<script
	module
	lang="ts"
>
	import { Euler, MathUtils, Quaternion } from 'three'

	import { OrientationVector } from '#lib/math/OrientationVector.js'

	const quaternionUtil = new Quaternion()
	const ovUtil = new OrientationVector()
	const eulerUtil = new Euler()
</script>

<script lang="ts">
	import {
		Point,
		type PointChangeEvent,
		type PointValue3dObject,
		type PointValue4dObject,
		RotationEuler,
		type RotationEulerChangeEvent,
		type RotationEulerValueObject,
		TabGroup,
		TabPage,
	} from 'svelte-tweakpane-ui'

	import type { Pose, PosePatch } from '#lib/math/index.js'

	import { orientationEuler, sharedEuler, sharedPose } from './sharedPose'
	import {
		changedAxes,
		formatInputNumber,
		formatSharedNumber,
		MIXED,
		type Shared,
		toInputNumber,
	} from './sharedValue'

	interface Props {
		/** The poses shown. Never empty. */
		poses: readonly Pose[]
		/** When false, the poses render as read-only text instead of editable controls. */
		editable: boolean
		/**
		 * Called on an edit with one patch per pose, in the order of `poses`. Each patch carries only
		 * the fields that pose has to change.
		 */
		onchange: (patches: PosePatch[]) => void
	}

	const { poses, editable, onchange }: Props = $props()

	const localPose = $derived(sharedPose(poses))
	const eulerValue = $derived(sharedEuler(poses))
	const isEulerMixed = $derived(Object.values(eulerValue).includes(MIXED))

	const shownPosition = $derived({
		x: toInputNumber(localPose.x),
		y: toInputNumber(localPose.y),
		z: toInputNumber(localPose.z),
	})
	const shownOrientation = $derived({
		x: toInputNumber(localPose.oX),
		y: toInputNumber(localPose.oY),
		z: toInputNumber(localPose.oZ),
		w: toInputNumber(localPose.theta),
	})
	const shownEuler = $derived({
		x: toInputNumber(eulerValue.x),
		y: toInputNumber(eulerValue.y),
		z: toInputNumber(eulerValue.z),
	})

	const handlePositionChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const patch = changedAxes(shownPosition, event.detail.value as PointValue3dObject)
		if (Object.keys(patch).length === 0) return

		onchange(poses.map(() => patch))
	}

	const isOrientationShared = $derived(
		[localPose.oX, localPose.oY, localPose.oZ, localPose.theta].every((value) => value !== MIXED)
	)

	/**
	 * A shared orientation shows the first pose's spelling, and another pose can spell the same
	 * rotation differently. So the whole shown orientation is written, never one field onto each
	 * pose's own spelling. A mixed orientation keeps each pose's own untouched fields.
	 */
	const handleOrientationOVChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as PointValue4dObject
		const { x, y, z, w } = changedAxes(shownOrientation, next)
		if ([x, y, z, w].every((value) => value === undefined)) return

		const patch = isOrientationShared
			? { oX: next.x, oY: next.y, oZ: next.z, theta: next.w }
			: { oX: x, oY: y, oZ: z, theta: w }
		onchange(poses.map(() => patch))
	}

	/**
	 * Writes the edited Euler angles into each pose's own orientation. An angle left alone keeps
	 * each pose's own value, so the rotation is rebuilt per pose.
	 */
	const writeEuler = (next: PointValue3dObject | RotationEulerValueObject) => {
		const patch = changedAxes(shownEuler, { x: next.x, y: next.y, z: next.z })
		if (Object.keys(patch).length === 0) return

		onchange(
			poses.map((pose) => {
				const angles = { ...orientationEuler(pose), ...patch }
				eulerUtil.set(
					MathUtils.degToRad(angles.x),
					MathUtils.degToRad(angles.y),
					MathUtils.degToRad(angles.z),
					'ZYX'
				)
				quaternionUtil.setFromEuler(eulerUtil)
				ovUtil.setFromQuaternion(quaternionUtil)
				return {
					oX: ovUtil.x,
					oY: ovUtil.y,
					oZ: ovUtil.z,
					theta: MathUtils.radToDeg(ovUtil.th),
				}
			})
		)
	}

	const handleOrientationEulerChange = (event: RotationEulerChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		writeEuler(event.detail.value as RotationEulerValueObject)
	}

	const handleMixedEulerChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		writeEuler(event.detail.value as PointValue3dObject)
	}
</script>

{#snippet ImmutableField({
	label,
	value,
	ariaLabel,
}: {
	label: string
	value: Shared<number>
	ariaLabel: string
})}
	<div>
		<span
			class="text-subtle-2"
			aria-label={`immutable ${ariaLabel}`}
		>
			{label}
		</span>

		{formatSharedNumber(value)}
	</div>
{/snippet}

<div>
	<strong class="font-semibold">local position</strong>
	<span class="text-subtle-2">(mm)</span>

	{#if editable}
		<div aria-label="mutable local position">
			<Point
				value={shownPosition}
				format={formatInputNumber}
				on:change={handlePositionChange}
			/>
		</div>
	{:else}
		<div class="mt-0.5 flex gap-3">
			{@render ImmutableField({
				label: 'x',
				ariaLabel: 'local position x coordinate',
				value: localPose.x,
			})}
			{@render ImmutableField({
				label: 'y',
				ariaLabel: 'local position y coordinate',
				value: localPose.y,
			})}
			{@render ImmutableField({
				label: 'z',
				ariaLabel: 'local position z coordinate',
				value: localPose.z,
			})}
		</div>
	{/if}
</div>

<div>
	<strong class="font-semibold">local orientation</strong>

	{#if editable}
		<div aria-label="mutable local orientation">
			<TabGroup>
				<TabPage title="OV (deg)">
					<Point
						value={shownOrientation}
						format={formatInputNumber}
						on:change={handleOrientationOVChange}
					/>
				</TabPage>
				<TabPage title="Euler">
					<!-- The rotation plugin converts through a quaternion, where one NaN spreads to every angle. -->
					{#if isEulerMixed}
						<Point
							value={shownEuler}
							format={formatInputNumber}
							on:change={handleMixedEulerChange}
						/>
					{:else}
						<RotationEuler
							value={shownEuler}
							unit="deg"
							on:change={handleOrientationEulerChange}
						/>
					{/if}
				</TabPage>
			</TabGroup>
		</div>
	{:else}
		<div class="mt-0.5 flex gap-3">
			{@render ImmutableField({
				label: 'x',
				ariaLabel: 'local orientation x coordinate',
				value: localPose.oX,
			})}
			{@render ImmutableField({
				label: 'y',
				ariaLabel: 'local orientation y coordinate',
				value: localPose.oY,
			})}
			{@render ImmutableField({
				label: 'z',
				ariaLabel: 'local orientation z coordinate',
				value: localPose.oZ,
			})}
			{@render ImmutableField({
				label: 'th',
				ariaLabel: 'local orientation theta degrees',
				value: localPose.theta,
			})}
		</div>
	{/if}
</div>

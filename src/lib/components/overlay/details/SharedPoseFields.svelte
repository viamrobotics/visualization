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
	import { Tabs } from '@viamrobotics/prime-controls'
	import { PersistedState } from 'runed'

	import type { Pose, PosePatch } from '#lib/math/index.js'

	import {
		DEFAULT_ORIENTATION_FORMAT,
		ORIENTATION_FORMAT_KEY,
		type OrientationFormat,
	} from './orientationFormat'
	import SharedNumberFields from './SharedNumberFields.svelte'
	import { orientationEuler, sharedEuler, sharedPose } from './sharedPose'
	import { formatSharedNumber, MIXED, type Shared } from './sharedValue'

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

	const orientationFormat = new PersistedState<OrientationFormat>(
		ORIENTATION_FORMAT_KEY,
		DEFAULT_ORIENTATION_FORMAT
	)

	const localPose = $derived(sharedPose(poses))
	const eulerValue = $derived(sharedEuler(poses))

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

	const isOrientationShared = $derived(
		[localPose.oX, localPose.oY, localPose.oZ, localPose.theta].every((value) => value !== MIXED)
	)

	/**
	 * A shared orientation shows the first pose's spelling, and another pose can spell the same
	 * rotation differently. So the whole shown orientation is written, never one field onto each
	 * pose's own spelling. A mixed orientation keeps each pose's own untouched fields.
	 */
	const writeOrientation = (patch: Partial<Record<'oX' | 'oY' | 'oZ' | 'theta', number>>) => {
		const next = isOrientationShared
			? {
					oX: localPose.oX as number,
					oY: localPose.oY as number,
					oZ: localPose.oZ as number,
					theta: localPose.theta as number,
					...patch,
				}
			: patch
		onchange(poses.map(() => next))
	}

	/**
	 * Writes the edited Euler angle into each pose's own orientation. An angle left alone keeps
	 * each pose's own value, so the rotation is rebuilt per pose.
	 */
	const writeEuler = (patch: Partial<Record<'x' | 'y' | 'z', number>>) => {
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
		<SharedNumberFields
			aria-label="local position (mm)"
			fields={POSITION_FIELDS}
			values={{ x: localPose.x, y: localPose.y, z: localPose.z }}
			onchange={(patch) => onchange(poses.map(() => patch))}
		/>
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
		<Tabs
			bind:value={
				() => orientationFormat.current,
				(next) => (orientationFormat.current = next as OrientationFormat)
			}
		>
			<Tabs.List aria-label="local orientation format">
				<Tabs.Trigger value="ov">OV (deg)</Tabs.Trigger>
				<Tabs.Trigger value="euler">Euler (deg)</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="ov">
				<SharedNumberFields
					aria-label="local orientation (OV, deg)"
					fields={ORIENTATION_FIELDS}
					values={{
						oX: localPose.oX,
						oY: localPose.oY,
						oZ: localPose.oZ,
						theta: localPose.theta,
					}}
					onchange={writeOrientation}
				/>
			</Tabs.Content>
			<Tabs.Content value="euler">
				<SharedNumberFields
					aria-label="local orientation (Euler, deg)"
					fields={POSITION_FIELDS}
					values={eulerValue}
					onchange={writeEuler}
				/>
			</Tabs.Content>
		</Tabs>
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

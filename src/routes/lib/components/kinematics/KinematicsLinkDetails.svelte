<script lang="ts">
	import { Button, Input, Switch } from '@viamrobotics/prime-core'

	import type { Link } from '$lib/buf/kinematics/v1/spec_pb'

	import { CollisionShape } from '$lib/buf/kinematics/v1/spec_pb'
	import ToggleGroup from '$lib/components/overlay/ToggleGroup.svelte'

	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import { unitHint } from '../../kinematics/unitHint'
	import { type UpAxis, upAxisOrientation } from '../../kinematics/upAxisOrientation'
	import { formatExtent } from './formatExtent'
	import { formatPrimitive } from './formatPrimitive'
	import { attachOptions } from './jointOptions'
	import KinematicsLocalPose from './KinematicsLocalPose.svelte'
	import KinematicsNameField from './KinematicsNameField.svelte'
	import KinematicsParentPicker from './KinematicsParentPicker.svelte'
	import KinematicsSourcePicker from './KinematicsSourcePicker.svelte'
	import { frameToPose, poseToFrame } from './poseFrame'
	import { SHAPE_LABELS, SHAPES, UNIT_LABELS, UNITS } from './unitOptions'

	interface Props {
		workbench: KinematicsWorkbench
		link: Link
		/** Selects the entity with this name once it exists. */
		select: (name: string) => void
	}

	const { workbench, link, select }: Props = $props()
	const id = $props.id()
	const trianglesHintId = `${id}-triangles-hint`

	const UP_AXES: UpAxis[] = ['z', 'y', 'x']

	const TOLERANCE = 1e-6

	/** The preset the mount orientation matches, or `undefined` when it was rotated by hand. */
	const matchUpAxis = (pose: Link['origin']): UpAxis | undefined => {
		let { oX = 0, oY = 0, oZ = 0, theta = 0 } = pose ?? {}
		if (oX === 0 && oY === 0 && oZ === 0) oZ = 1
		return UP_AXES.find((axis) => {
			const preset = upAxisOrientation(axis)
			return (
				Math.abs(preset.oX - oX) < TOLERANCE &&
				Math.abs(preset.oY - oY) < TOLERANCE &&
				Math.abs(preset.oZ - oZ) < TOLERANCE &&
				Math.abs(preset.theta - theta) < TOLERANCE
			)
		})
	}

	const linkReport = $derived(workbench.report?.links.find((entry) => entry.id === link.id))
	const before = $derived(workbench.previous?.report.links.find((entry) => entry.id === link.id))
	const primitive = $derived(link.primitive)
	const primitiveText = $derived(formatPrimitive(primitive))
	const upAxis = $derived(matchUpAxis(link.origin))
	const hint = $derived(unitHint(linkReport?.extent, link.meshUnit))

	const unitOptions = $derived(
		UNITS.map((unit) => ({ label: UNIT_LABELS[unit]!, selected: link.meshUnit === unit }))
	)
	const axisOptions = $derived(
		UP_AXES.map((axis) => ({ label: axis.toUpperCase(), value: axis, selected: upAxis === axis }))
	)
	// An unset shape builds as a decimated mesh, so the controls show it as one.
	const collision = $derived(
		link.collision === CollisionShape.UNSPECIFIED ? CollisionShape.MESH : link.collision
	)
	const shapeOptions = $derived(
		SHAPES.map((shape) => ({ label: SHAPE_LABELS[shape]!, selected: collision === shape }))
	)

	const setUnit = (label: string | undefined) => {
		const unit = UNITS.find((candidate) => UNIT_LABELS[candidate] === label)
		if (unit !== undefined) workbench.updateLink(link.id, { meshUnit: unit })
	}

	const setUpAxis = (value: string | undefined) => {
		const axis = UP_AXES.find((candidate) => candidate === value)
		if (!axis) return
		workbench.updateLink(link.id, {
			origin: { ...frameToPose(poseToFrame(link.origin)), ...upAxisOrientation(axis) },
		})
	}

	const setShape = (label: string | undefined) => {
		const shape = SHAPES.find((candidate) => SHAPE_LABELS[candidate] === label)
		if (shape !== undefined) workbench.updateLink(link.id, { collision: shape })
	}

	const setTriangles = (event: Event) => {
		const input = event.target as HTMLInputElement
		const value = Number.parseInt(input.value, 10)
		if (Number.isFinite(value) && value >= 0) {
			workbench.updateLink(link.id, { maxTriangles: value })
		} else {
			// prime's Input keeps what was typed, so put the stored value back.
			input.value = String(link.maxTriangles)
		}
	}

	/** A joint at the link's position, under the link's parent, with the link moved onto it. */
	const addJoint = () => {
		const mount = link.origin
		const id = workbench.addJoint({
			parent: link.parent,
			origin: {
				x: mount?.x ?? 0,
				y: mount?.y ?? 0,
				z: mount?.z ?? 0,
				oX: 0,
				oY: 0,
				oZ: 1,
				theta: 0,
			},
		})
		workbench.updateLink(link.id, { parent: id })
		select(id)
	}
</script>

<div class="flex flex-col gap-2.5 pt-3">
	<KinematicsNameField
		value={link.id}
		taken={(name) =>
			name === workbench.spec.name ||
			name === 'tcp' ||
			workbench.spec.links.some((item) => item.id === name) ||
			workbench.spec.joints.some((item) => item.id === name)}
		onrename={(name) => {
			workbench.updateLink(link.id, { id: name })
			select(name)
		}}
	/>

	<KinematicsParentPicker
		label="Parent"
		value={link.parent}
		options={attachOptions(workbench.spec.joints)}
		baseLabel="root"
		onchange={(parent) => workbench.updateLink(link.id, { parent })}
	/>

	<KinematicsLocalPose
		spec={workbench.spec}
		parent={link.parent}
		pose={link.origin}
		onchange={(origin) => workbench.updateLink(link.id, { origin })}
	/>

	<section
		class="flex flex-col gap-3"
		aria-label="Geometry"
	>
		<h4 class="text-heading text-xs font-semibold">Geometry</h4>

		{#if primitive}
			<div
				class="flex items-center justify-between gap-2 text-xs"
				role="group"
				aria-label="Shape"
			>
				<span class="text-default">Shape</span>
				<span class="text-subtle-2 font-roboto-mono text-xs">
					{primitiveText ?? ''}
				</span>
			</div>
		{:else}
			<div
				class="flex items-center justify-between gap-2 text-xs"
				role="group"
				aria-label="Mesh file"
			>
				<span class="text-default">Mesh file</span>
				<span class="text-subtle-2 font-roboto-mono truncate text-xs">{link.meshPath}</span>
				<KinematicsSourcePicker
					label="Replace file for {link.id}"
					text="Replace file"
					onpick={(bytes) => workbench.setSourceBytes(link.meshPath, bytes)}
				/>
			</div>

			<div
				class="flex items-center justify-between gap-2 text-xs"
				role="group"
				aria-label="Mesh units"
			>
				<span class="text-default">Mesh units</span>
				<ToggleGroup
					options={unitOptions}
					onSelect={(details) => setUnit(details[0])}
				/>
			</div>

			{#if hint !== undefined}
				<Button
					variant="outline-success"
					textSize="text-xs"
					onclick={() => workbench.updateLink(link.id, { meshUnit: hint })}
				>
					This looks like {UNIT_LABELS[hint]}. Switch to {UNIT_LABELS[hint]}
				</Button>
			{/if}

			<div
				class="flex items-center justify-between gap-2 text-xs"
				role="group"
				aria-label="Up axis"
			>
				<span class="text-default">Up axis</span>
				<ToggleGroup
					options={axisOptions}
					onSelect={(details) => setUpAxis(details[0])}
				/>
			</div>

			<div
				class="flex items-center justify-between gap-2 text-xs"
				role="group"
				aria-label="Collision"
			>
				<span class="text-default">Collision</span>
				<ToggleGroup
					options={shapeOptions}
					onSelect={(details) => setShape(details[0])}
				/>
			</div>

			{#if collision === CollisionShape.MESH}
				<div class="flex flex-col gap-1">
					<label class="text-default flex items-center justify-between gap-2 text-xs">
						Max triangles
						<Input
							type="number"
							min="0"
							step="100"
							value={link.maxTriangles}
							aria-describedby={trianglesHintId}
							on:change={setTriangles}
						/>
					</label>
					<p
						id={trianglesHintId}
						class="text-subtle-2 text-xs"
					>
						0 keeps every triangle.
					</p>
				</div>
			{/if}
		{/if}

		{#if linkReport?.overTriangleLimit}
			<div class="flex flex-col gap-2 text-xs">
				<p class="text-warning-dark">
					Collision mesh has {linkReport.triangles} triangles, over the limit of {linkReport.suggestedMaxTriangles}.
				</p>
				<Button
					variant="ghost-outline"
					textSize="text-xs"
					onclick={() => workbench.simplify(link.id)}
				>
					Simplify
				</Button>
			</div>
		{/if}
	</section>

	{#if before && linkReport}
		<section
			class="flex flex-col gap-2"
			aria-label="Changed from the previous build"
		>
			<h4 class="text-heading text-xs font-semibold">Changed from the previous build</h4>
			<dl class="text-default grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
				<dt class="text-subtle-2">Triangles</dt>
				<dd>{before.triangles} to {linkReport.triangles}</dd>
				<dt class="text-subtle-2">Extent</dt>
				<dd class="font-roboto-mono">
					{formatExtent(before.extent)} to {formatExtent(linkReport.extent)}
				</dd>
			</dl>
			<label class="text-default flex items-center justify-between gap-2 text-xs">
				Show previous geometry
				<Switch
					on={workbench.showPrevious}
					on:change={(event) => (workbench.showPrevious = event.detail)}
				/>
			</label>
		</section>
	{/if}
</div>

<h3 class="text-subtle-2 pt-3 pb-2">Actions</h3>

<Button
	variant="ghost-outline"
	class="w-full"
	onclick={addJoint}
>
	Add joint for this link
</Button>

<Button
	variant="danger"
	class="mt-2 w-full"
	onclick={() => workbench.removeLink(link.id)}
>
	Remove link
</Button>

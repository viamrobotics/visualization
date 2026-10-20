<script lang="ts">
	import { Button } from '@viamrobotics/prime-core'
	import {
		Point,
		type PointChangeEvent,
		type PointValue3dObject,
		Slider,
		type SliderChangeEvent,
	} from 'svelte-tweakpane-ui'

	import type { Joint } from '$lib/buf/kinematics/v1/spec_pb'

	import { JointType } from '$lib/buf/kinematics/v1/spec_pb'
	import ToggleGroup from '$lib/components/overlay/ToggleGroup.svelte'

	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import { fromDisplayUnits, toDisplayUnits, unitSuffix } from './inputUnits'
	import { mimicOptions, parentOptions } from './jointOptions'
	import KinematicsLocalPose from './KinematicsLocalPose.svelte'
	import KinematicsNameField from './KinematicsNameField.svelte'
	import KinematicsNumberField from './KinematicsNumberField.svelte'
	import KinematicsParentPicker from './KinematicsParentPicker.svelte'

	interface Props {
		workbench: KinematicsWorkbench
		joint: Joint
		/** Selects the entity with this name once it exists. */
		select: (name: string) => void
	}

	const { workbench, joint, select }: Props = $props()

	const TYPES = [
		{ label: 'Revolute', type: JointType.REVOLUTE },
		{ label: 'Prismatic', type: JointType.PRISMATIC },
	]

	const typeOptions = $derived(
		TYPES.map((entry) => ({ label: entry.label, selected: joint.type === entry.type }))
	)
	const limitUnit = $derived(unitSuffix(joint.type))
	const parents = $derived(parentOptions(workbench.spec.joints, joint.id))
	const mimics = $derived(mimicOptions(workbench.spec.joints, joint.id))

	const inputIndex = $derived(
		workbench.report?.inputs.findIndex((input) => input.joint === joint.id) ?? -1
	)
	const input = $derived(inputIndex >= 0 ? workbench.report?.inputs[inputIndex] : undefined)
	const position = $derived(
		input ? toDisplayUnits(input.type, workbench.inputs[inputIndex] ?? 0) : 0
	)

	const setType = (label: string | undefined) => {
		const entry = TYPES.find((candidate) => candidate.label === label)
		if (entry) workbench.updateJoint(joint.id, { type: entry.type })
	}

	const setAxis = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as PointValue3dObject
		workbench.updateJoint(joint.id, { axis: { x: next.x, y: next.y, z: next.z } })
	}

	const setPosition = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal' || !input) return
		workbench.setInput(inputIndex, fromDisplayUnits(input.type, event.detail.value))
	}

	const setMimicSource = (source: string) => {
		workbench.updateJoint(joint.id, {
			mimic: source === '' ? undefined : { joint: source, multiplier: 1, offset: 0 },
		})
	}

	const setMimicField = (key: 'multiplier' | 'offset', value: number) => {
		if (!joint.mimic) return
		workbench.updateJoint(joint.id, {
			mimic: {
				joint: joint.mimic.joint,
				multiplier: joint.mimic.multiplier,
				offset: joint.mimic.offset,
				[key]: value,
			},
		})
	}

	const addChild = () => select(workbench.addJoint({ parent: joint.id, origin: joint.origin }))
</script>

<div class="flex flex-col gap-2.5 pt-3">
	<KinematicsNameField
		value={joint.id}
		taken={(name) =>
			name === workbench.spec.name ||
			name === 'tcp' ||
			workbench.spec.links.some((item) => item.id === name) ||
			workbench.spec.joints.some((item) => item.id === name)}
		onrename={(name) => {
			workbench.updateJoint(joint.id, { id: name })
			select(name)
		}}
	/>

	<KinematicsParentPicker
		label="Parent"
		value={joint.parent}
		options={parents}
		baseLabel="root"
		onchange={(parent) => workbench.updateJoint(joint.id, { parent })}
	/>

	<KinematicsLocalPose
		spec={workbench.spec}
		parent={joint.parent}
		pose={joint.origin}
		onchange={(origin) => workbench.updateJoint(joint.id, { origin })}
	/>

	<section
		class="flex flex-col gap-2.5"
		aria-label="Motion"
	>
		<h4 class="text-heading text-xs font-semibold">Motion</h4>

		<div
			class="flex items-center justify-between gap-2 text-xs"
			role="group"
			aria-label="Type"
		>
			<span class="text-default">Type</span>
			<ToggleGroup
				options={typeOptions}
				onSelect={(details) => setType(details[0])}
			/>
		</div>

		<div>
			<strong class="font-semibold">Axis</strong>

			<div aria-label="mutable Axis">
				<Point
					value={{ x: joint.axis?.x ?? 0, y: joint.axis?.y ?? 0, z: joint.axis?.z ?? 0 }}
					on:change={setAxis}
				/>
			</div>
		</div>

		{#if !joint.mimic}
			<KinematicsNumberField
				label="Lower"
				unit={limitUnit}
				value={joint.lower}
				onchange={(min) => workbench.updateJoint(joint.id, { lower: min })}
			/>
			<KinematicsNumberField
				label="Upper"
				unit={limitUnit}
				value={joint.upper}
				onchange={(max) => workbench.updateJoint(joint.id, { upper: max })}
			/>
		{/if}

		<KinematicsParentPicker
			label="Mimic"
			value={joint.mimic?.joint ?? ''}
			options={mimics}
			onchange={setMimicSource}
			baseLabel="None"
		/>

		{#if joint.mimic}
			<KinematicsNumberField
				label="Multiplier"
				value={joint.mimic.multiplier}
				onchange={(value) => setMimicField('multiplier', value)}
			/>
			<KinematicsNumberField
				label="Offset"
				value={joint.mimic.offset}
				onchange={(value) => setMimicField('offset', value)}
			/>
		{/if}

		{#if input}
			<div>
				<strong class="font-semibold">Position</strong>
				<span class="text-subtle-2">({unitSuffix(input.type)})</span>

				<div aria-label="mutable Position">
					<Slider
						value={position}
						min={toDisplayUnits(input.type, input.min)}
						max={toDisplayUnits(input.type, input.max)}
						step={0.1}
						format={(value) => `${value.toFixed(1)} ${unitSuffix(input.type)}`}
						on:change={setPosition}
					/>
				</div>
			</div>
		{/if}
	</section>
</div>

<h3 class="text-subtle-2 pt-3 pb-2">Actions</h3>

<Button
	variant="ghost-outline"
	class="w-full"
	onclick={addChild}
>
	Add child joint
</Button>

<Button
	variant="danger"
	class="mt-2 w-full"
	onclick={() => workbench.removeJoint(joint.id)}
>
	Remove joint
</Button>

<script lang="ts">
	import { type Entity } from 'koota'
	import {
		Point,
		type PointChangeEvent,
		type PointValue3dObject,
		Slider,
		type SliderChangeEvent,
		TabGroup,
		TabPage,
	} from 'svelte-tweakpane-ui'

	import { traits, useTrait } from '$lib/ecs'
	import { FrameEditor } from '$lib/editing/FrameEditor'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const partConfig = usePartConfig()

	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)

	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)

	const geometryType = $derived.by(() => {
		if (box.current) return 'box'
		if (sphere.current) return 'sphere'
		if (capsule.current) return 'capsule'
		return 'none'
	})

	const geometryTypes = ['none', 'box', 'sphere', 'capsule'] as const

	let geometryTabIndex = $derived(geometryTypes.indexOf(geometryType))

	$effect(() => {
		const nextType = geometryTypes[geometryTabIndex]

		// A trait-driven recompute leaves nextType equal to geometryType. Firing then
		// calls updateFrame and resets the geometry to default dimensions. Only a
		// user tab pick sets the index ahead of the trait.
		if (nextType === geometryType) return

		frameEditor.setGeometryType(entity, nextType)
	})

	const handleBoxChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		const next = event.detail.value as PointValue3dObject
		frameEditor.setGeometry(entity, {
			type: 'box',
			x: next.x,
			y: next.y,
			z: next.z,
		})
	}

	const handleSphereRChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		frameEditor.setGeometry(entity, { type: 'sphere', r: event.detail.value })
	}

	const handleCapsuleRChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		frameEditor.setGeometry(entity, { type: 'capsule', r: event.detail.value })
	}

	const handleCapsuleLChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		frameEditor.setGeometry(entity, { type: 'capsule', l: event.detail.value })
	}
</script>

<div>
	<strong class="font-semibold">geometry</strong>
	<span class="text-subtle-2">(mm)</span>
	<div aria-label="mutable geometry">
		<TabGroup bind:selectedIndex={geometryTabIndex}>
			<TabPage title="None" />
			<TabPage title="Box">
				{#if box.current}
					<div aria-label="mutable box dimensions">
						<Point
							value={{
								x: box.current.x,
								y: box.current.y,
								z: box.current.z,
							}}
							min={0}
							on:change={handleBoxChange}
						/>
					</div>
				{/if}
			</TabPage>
			<TabPage title="Sphere">
				{#if sphere.current}
					<div aria-label="mutable sphere dimensions">
						<Slider
							label="r"
							value={sphere.current.r}
							min={0}
							on:change={handleSphereRChange}
						/>
					</div>
				{/if}
			</TabPage>
			<TabPage title="Capsule">
				{#if capsule.current}
					<div aria-label="mutable capsule dimensions">
						<Slider
							label="r"
							value={capsule.current.r}
							min={0}
							on:change={handleCapsuleRChange}
						/>
						<Slider
							label="l"
							value={capsule.current.l}
							min={0}
							on:change={handleCapsuleLChange}
						/>
					</div>
				{/if}
			</TabPage>
		</TabGroup>
	</div>
</div>

<style>
	:global(.tp-tabv_i) {
		display: none;
	}

	:global(.tp-lblv),
	:global(.tp-tbpv_c) {
		padding-left: 0 !important;
	}
</style>

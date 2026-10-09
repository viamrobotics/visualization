<!--
@component

The geometry type tabs and dimension controls, driven by a value rather than an
entity, so any frame-shaped geometry can be edited with them.
-->
<script lang="ts">
	import { untrack } from 'svelte'
	import {
		Point,
		type PointChangeEvent,
		type PointValue3dObject,
		Slider,
		type SliderChangeEvent,
		TabGroup,
		TabPage,
	} from 'svelte-tweakpane-ui'

	import { defaultFrameGeometry, type EditableFrameGeometry } from '$lib/defaultFrameGeometry'

	interface Props {
		/** The geometry to show. Undefined reads as `none`. */
		geometry: EditableFrameGeometry | undefined
		/** Called with the whole next geometry: a type switch passes that type's default. */
		onchange: (geometry: EditableFrameGeometry) => void
		/** Whether `None` is offered. An obstacle geometry always has a shape, a frame may have none. */
		includeNone: boolean
	}

	const { geometry, onchange, includeNone }: Props = $props()

	const geometryTypes: readonly EditableFrameGeometry['type'][] = $derived(
		includeNone
			? (['none', 'box', 'sphere', 'capsule'] as const)
			: (['box', 'sphere', 'capsule'] as const)
	)

	const geometryType = $derived(geometry?.type ?? 'none')

	let geometryTabIndex = $derived(geometryTypes.indexOf(geometryType))

	$effect(() => {
		const nextType = geometryTypes[geometryTabIndex]

		// A prop-driven recompute leaves nextType equal to geometryType. Emitting then
		// would reset the geometry to default dimensions. Only a user tab pick sets the
		// index ahead of the prop.
		if (nextType === undefined || nextType === untrack(() => geometryType)) return

		untrack(() => onchange(defaultFrameGeometry(nextType)))
	})

	const handleBoxChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as PointValue3dObject
		onchange({ type: 'box', x: next.x, y: next.y, z: next.z })
	}

	const handleSphereRChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		onchange({ type: 'sphere', r: event.detail.value })
	}

	const handleCapsuleRChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal' || geometry?.type !== 'capsule') return
		onchange({ ...geometry, r: event.detail.value })
	}

	const handleCapsuleLChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal' || geometry?.type !== 'capsule') return
		onchange({ ...geometry, l: event.detail.value })
	}
</script>

<div>
	<strong class="font-semibold">geometry</strong>
	<span class="text-subtle-2">(mm)</span>
	<div aria-label="mutable geometry">
		<TabGroup bind:selectedIndex={geometryTabIndex}>
			{#if includeNone}
				<TabPage title="None" />
			{/if}
			<TabPage title="Box">
				{#if geometry?.type === 'box'}
					<div aria-label="mutable box dimensions">
						<Point
							value={{ x: geometry.x, y: geometry.y, z: geometry.z }}
							min={0}
							on:change={handleBoxChange}
						/>
					</div>
				{/if}
			</TabPage>
			<TabPage title="Sphere">
				{#if geometry?.type === 'sphere'}
					<div aria-label="mutable sphere dimensions">
						<Slider
							label="r"
							value={geometry.r}
							min={0}
							on:change={handleSphereRChange}
						/>
					</div>
				{/if}
			</TabPage>
			<TabPage title="Capsule">
				{#if geometry?.type === 'capsule'}
					<div aria-label="mutable capsule dimensions">
						<Slider
							label="r"
							value={geometry.r}
							min={0}
							on:change={handleCapsuleRChange}
						/>
						<Slider
							label="l"
							value={geometry.l}
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

<!--
@component

Local position and orientation controls driven by a value rather than an
entity, for frames that live in component attributes instead of the scene.
-->
<script lang="ts">
	import {
		Point,
		type PointChangeEvent,
		type PointValue3dObject,
		type PointValue4dObject,
		TabGroup,
		TabPage,
	} from 'svelte-tweakpane-ui'

	import type { Frame } from '$lib/frame'

	import { Pose } from '$lib/math'

	interface Props {
		/** Undefined reads as the origin. */
		translation: Frame['translation'] | undefined
		/** Any rdk orientation shape. Undefined reads as no rotation. */
		orientation: Frame['orientation'] | undefined
		/** Called with the whole next pose. Orientation always comes back as `ov_degrees`. */
		onchange: (pose: Pick<Frame, 'translation' | 'orientation'>) => void
	}

	const { translation, orientation, onchange }: Props = $props()

	const pose = $derived(new Pose().setFromFrame({ translation, orientation }))

	const currentTranslation = () => ({ x: pose.x, y: pose.y, z: pose.z })

	const currentOrientation = (): Frame['orientation'] => ({
		type: 'ov_degrees',
		value: { x: pose.oX, y: pose.oY, z: pose.oZ, th: pose.theta },
	})

	const handlePositionChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as PointValue3dObject
		onchange({
			translation: { x: next.x, y: next.y, z: next.z },
			orientation: currentOrientation(),
		})
	}

	const handleOrientationChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as PointValue4dObject
		onchange({
			translation: currentTranslation(),
			orientation: {
				type: 'ov_degrees',
				value: { x: next.x, y: next.y, z: next.z, th: next.w },
			},
		})
	}
</script>

<div>
	<strong class="font-semibold">local position</strong>
	<span class="text-subtle-2">(mm)</span>

	<div aria-label="mutable local position">
		<Point
			value={{ x: pose.x, y: pose.y, z: pose.z }}
			on:change={handlePositionChange}
		/>
	</div>
</div>

<div>
	<strong class="font-semibold">local orientation</strong>

	<div aria-label="mutable local orientation">
		<TabGroup>
			<TabPage title="OV (deg)">
				<Point
					value={{ x: pose.oX, y: pose.oY, z: pose.oZ, w: pose.theta }}
					on:change={handleOrientationChange}
				/>
			</TabPage>
		</TabGroup>
	</div>
</div>

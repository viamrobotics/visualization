<script lang="ts">
	import type { IntersectionEvent } from '@threlte/extras'
	import type { XRTargetRaySpace } from 'three'

	import { T, useTask, useThrelte } from '@threlte/core'
	import { Controller, useController, useHeadset } from '@threlte/xr'
	import { onDestroy } from 'svelte'
	import { MathUtils, Vector3 } from 'three'
	import { TransformControls } from 'three/addons/controls/TransformControls.js'
	import { Text } from 'threlte-uikit'
	import { Button, ButtonIcon, ButtonLabel, Panel } from 'threlte-uikit/horizon'
	import { Icon, Locate, Move3d, Plus, Rotate3d, Scale3d } from 'threlte-uikit/lucide'

	import { traits, useTrait } from '$lib/ecs'
	import { FrameConfigUpdater } from '$lib/FrameConfigUpdater.svelte'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useFramelessComponents } from '$lib/hooks/useFramelessComponents.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { useSelectedEntity, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { OrientationVector } from '$lib/three/OrientationVector'

	import { useOrigin } from '../useOrigin.svelte'
	import WristDisplay from '../WristDisplay.svelte'

	type Mode = 'translate' | 'rotate' | 'scale'
	type Handedness = 'left' | 'right'

	type BoxBase = { type: 'box'; x: number; y: number; z: number }
	type SphereBase = { type: 'sphere'; r: number }
	type CapsuleBase = { type: 'capsule'; r: number; l: number }
	type GeometryBase = BoxBase | SphereBase | CapsuleBase

	const { camera, renderer, scene } = useThrelte()
	const selectedEntity = useSelectedEntity()
	const selectedObject3d = useSelectedObject3d()
	const partConfig = usePartConfig()
	const transformControls = useTransformControls()
	const framelessComponents = useFramelessComponents()
	const framesAPI = useTrait(() => selectedEntity.current, traits.FramesAPI)
	const leftController = useController('left')
	const rightController = useController('right')
	const headset = useHeadset()
	const origin = useOrigin()

	const resetForward = new Vector3()
	const resetHead = new Vector3()
	const resetOrigin = () => {
		resetForward.set(0, 0, -1).applyQuaternion(headset.quaternion)
		resetForward.z = 0
		if (resetForward.lengthSq() < 1e-6) {
			resetForward.set(0, 1, 0)
		} else {
			resetForward.normalize()
		}
		// headset.position/quaternion live in the composed XR reference space;
		// convert into zUp before writing to origin.
		origin.toZUpPos(resetHead, headset.position)
		origin.toZUpDir(resetForward)
		origin.set([resetHead.x + resetForward.x, resetHead.y + resetForward.y, 0], 0)
		origin.commit()
	}

	const updater = new FrameConfigUpdater(partConfig.updateFrame, partConfig.deleteFrame)

	const box = useTrait(() => selectedEntity.current, traits.Box)
	const sphere = useTrait(() => selectedEntity.current, traits.Sphere)
	const capsule = useTrait(() => selectedEntity.current, traits.Capsule)

	const geometryType = $derived.by<'box' | 'sphere' | 'capsule' | undefined>(() => {
		if (box.current) return 'box'
		if (sphere.current) return 'sphere'
		if (capsule.current) return 'capsule'
		return undefined
	})
	const hasGeometry = $derived(geometryType !== undefined)

	const controls = new TransformControls(camera.current, renderer.domElement)
	controls.setSize(0.25)

	const helper = controls.getHelper()
	const raycaster = controls.getRaycaster()

	let mode = $state<Mode>('translate')
	let activeHandedness = $state.raw<Handedness>()
	let attached = $state(false)
	let addingFrame = $state(false)

	// Snapshot of the geometry dims at drag start. Used in scale mode to compute
	// `newDims = base * absoluteScaleFactor` each frame; cleared on drag end.
	let geometryBase: GeometryBase | undefined

	const getRay = (handedness: Handedness | undefined): XRTargetRaySpace | undefined => {
		if (handedness === 'left') return leftController.current?.targetRay
		if (handedness === 'right') return rightController.current?.targetRay
		return undefined
	}

	const detectHandedness = (event: IntersectionEvent<PointerEvent>): Handedness | undefined => {
		// nativeEvent is three's selectstart/selectend event whose `target` is the XRTargetRaySpace.
		const target = (event.nativeEvent as { target?: unknown } | undefined)?.target
		if (target && target === leftController.current?.targetRay) return 'left'
		if (target && target === rightController.current?.targetRay) return 'right'
		return undefined
	}

	$effect(() => {
		controls.setMode(mode)
	})

	// Constrain which axes the gizmo exposes while in scale mode:
	//   box: all three (width/height/depth)
	//   capsule: X (radius) + Z (length); hide Y since capsules are radially symmetric
	//   sphere: X only; a single handle drives the radius
	// Translate/rotate always show all three.
	$effect(() => {
		if (mode !== 'scale') {
			controls.showX = true
			controls.showY = true
			controls.showZ = true
			return
		}
		switch (geometryType) {
			case 'box': {
				controls.showX = true
				controls.showY = true
				controls.showZ = true
				break
			}
			case 'capsule': {
				controls.showX = true
				controls.showY = false
				controls.showZ = true
				break
			}
			case 'sphere': {
				controls.showX = true
				controls.showY = false
				controls.showZ = false
				break
			}
			default: {
				controls.showX = false
				controls.showY = false
				controls.showZ = false
			}
		}
	})

	// selectedObject3d resolves to the named Mesh from Mesh.svelte; the Group that
	// carries the frame's pose is its parent (set up in Frame.svelte).
	$effect(() => {
		if (!framesAPI.current || !partConfig.hasEditPermissions) {
			controls.detach()
			attached = false
			return
		}
		const target = selectedObject3d.current?.parent
		if (target && target !== scene) {
			controls.attach(target)
			attached = true
		} else {
			controls.detach()
			attached = false
		}
	})

	// `Raycaster.setFromXRController` reads `ray.matrixWorld`. When hand-tracking
	// is active in the session, `@threlte/xr` does not attach the controller's
	// targetRay to the scene graph (see `Controller.svelte`'s
	// `{#if !isHandTracking.current}`), so scene traversal never refreshes its
	// matrixWorld. We have to call `updateMatrixWorld()` ourselves or the ray
	// aims wherever the controller was last attached.
	const setRaycasterFromRay = (ray: XRTargetRaySpace) => {
		ray.updateMatrixWorld(true)
		raycaster.setFromXRController(ray)
	}

	const onPointerDown = (event: IntersectionEvent<PointerEvent>) => {
		activeHandedness = detectHandedness(event)
		const ray = getRay(activeHandedness)
		if (!ray) return
		setRaycasterFromRay(ray)
		controls.pointerHover(null)
		controls.pointerDown(null)
	}

	const onPointerUp = () => {
		const ray = getRay(activeHandedness)
		if (ray) setRaycasterFromRay(ray)
		controls.pointerUp(null)
		activeHandedness = undefined
	}

	// Per-frame: while dragging, keep pointerMove firing even if the active ray
	// wobbles off the gizmo. Otherwise, drive pointerHover for axis highlight.
	useTask(() => {
		if (!controls.object) return

		if (controls.dragging) {
			const ray = getRay(activeHandedness)
			if (!ray) return
			setRaycasterFromRay(ray)
			controls.pointerMove(null)
			return
		}

		const rays = [rightController.current?.targetRay, leftController.current?.targetRay]
		for (const ray of rays) {
			if (!ray) continue
			setRaycasterFromRay(ray)
			controls.pointerHover(null)
			if (controls.axis !== null) return
		}
	})

	const ov = new OrientationVector()

	// Snapshot the current geometry dims when a scale-mode drag begins so every
	// frame can compute `newDims = base * controls.object.scale` from a stable
	// baseline, and clear the snapshot on drag end.
	controls.addEventListener('mouseDown', () => {
		transformControls.setActive(true)
		if (mode !== 'scale') return
		if (box.current) {
			geometryBase = { type: 'box', x: box.current.x, y: box.current.y, z: box.current.z }
		} else if (sphere.current) {
			geometryBase = { type: 'sphere', r: sphere.current.r }
		} else if (capsule.current) {
			geometryBase = { type: 'capsule', r: capsule.current.r, l: capsule.current.l }
		} else {
			geometryBase = undefined
		}
	})

	controls.addEventListener('mouseUp', () => {
		transformControls.setActive(false)
		geometryBase = undefined
	})

	controls.addEventListener('objectChange', () => {
		const entity = selectedEntity.current
		const target = controls.object
		if (!entity || !target) return

		if (mode === 'translate') {
			// three.js scene is in meters; FrameConfigUpdater stores mm.
			updater.updateLocalPosition(entity, {
				x: target.position.x * 1000,
				y: target.position.y * 1000,
				z: target.position.z * 1000,
			})
		} else if (mode === 'rotate') {
			ov.setFromQuaternion(target.quaternion)
			updater.updateLocalOrientation(entity, {
				oX: ov.x,
				oY: ov.y,
				oZ: ov.z,
				theta: MathUtils.radToDeg(ov.th),
			})
		} else if (geometryBase) {
			// Scale mode: `target.scale` is the absolute factor since drag start
			// because TC's internal `_scaleStart` was `(1,1,1)`. Apply it to the
			// baseline dims, write back through the trait so the mesh regenerates
			// at the new size, then snap the group's scale back to 1 so the next
			// frame's regenerated geometry isn't re-scaled visually.
			const s = target.scale
			if (geometryBase.type === 'box') {
				updater.updateGeometry(entity, {
					type: 'box',
					x: geometryBase.x * s.x,
					y: geometryBase.y * s.y,
					z: geometryBase.z * s.z,
				})
			} else if (geometryBase.type === 'sphere') {
				updater.updateGeometry(entity, {
					type: 'sphere',
					r: geometryBase.r * s.x,
				})
			} else {
				updater.updateGeometry(entity, {
					type: 'capsule',
					r: geometryBase.r * s.x,
					l: geometryBase.l * s.z,
				})
			}
			target.scale.set(1, 1, 1)
		}
	})

	onDestroy(() => {
		transformControls.setActive(false)
		controls.detach()
		controls.dispose()
	})
</script>

<Controller left />
<Controller right />

<T
	is={helper}
	onpointerdown={onPointerDown as never}
	onpointerup={onPointerUp as never}
/>

{#if partConfig.hasEditPermissions}
	<WristDisplay position={[0, 0.005, 0.04]}>
		<Panel
			flexDirection="row"
			padding={8}
			gap={8}
			backgroundColor="#111"
			borderRadius={16}
		>
			<Button
				icon
				size="sm"
				variant="tertiary"
				onclick={resetOrigin}
			>
				<ButtonIcon>
					<Icon is={Locate} />
				</ButtonIcon>
			</Button>
			<Button
				icon
				size="sm"
				variant={addingFrame ? 'primary' : 'tertiary'}
				onclick={() => (addingFrame = !addingFrame)}
			>
				<ButtonIcon>
					<Icon is={Plus} />
				</ButtonIcon>
			</Button>
			{#if attached}
				<Button
					icon
					size="sm"
					variant={mode === 'translate' ? 'primary' : 'tertiary'}
					onclick={() => (mode = 'translate')}
				>
					<ButtonIcon>
						<Icon is={Move3d} />
					</ButtonIcon>
				</Button>
				<Button
					icon
					size="sm"
					variant={mode === 'rotate' ? 'primary' : 'tertiary'}
					onclick={() => (mode = 'rotate')}
				>
					<ButtonIcon>
						<Icon is={Rotate3d} />
					</ButtonIcon>
				</Button>
				<Button
					icon
					size="sm"
					disabled={!hasGeometry}
					variant={mode === 'scale' ? 'primary' : 'tertiary'}
					onclick={() => (mode = 'scale')}
				>
					<ButtonIcon>
						<Icon is={Scale3d} />
					</ButtonIcon>
				</Button>
			{/if}
		</Panel>
	</WristDisplay>

	{#if addingFrame}
		<WristDisplay position={[0, 0.005, 0.14]}>
			<Panel
				flexDirection="column"
				padding={12}
				gap={6}
				backgroundColor="#111"
				borderRadius={16}
				minWidth={320}
			>
				{#if framelessComponents.current.length > 0}
					{#each framelessComponents.current as component (component)}
						<Button
							size="sm"
							variant="tertiary"
							onclick={() => {
								partConfig.createFrame(component)
								addingFrame = false
							}}
						>
							<ButtonLabel>
								<Text
									text={component}
									fontSize={14}
									color="#ffffff"
								/>
							</ButtonLabel>
						</Button>
					{/each}
				{:else}
					<Text
						text="No components without frames"
						fontSize={14}
						color="#ffffff"
					/>
				{/if}
			</Panel>
		</WristDisplay>
	{/if}
{/if}

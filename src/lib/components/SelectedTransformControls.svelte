<script lang="ts">
	import { TransformControls } from '@threlte/extras'
	import { MathUtils, Quaternion, Vector3 } from 'three'

	import { traits, useTrait } from '$lib/ecs'
	import { FrameConfigUpdater } from '$lib/FrameConfigUpdater.svelte'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { useSelectedEntity, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { OrientationVector } from '$lib/three/OrientationVector'
	import { quaternionToPose, vector3ToPose } from '$lib/transform'

	const settings = useSettings()
	const environment = useEnvironment()
	const transformControls = useTransformControls()
	const selectedEntity = useSelectedEntity()
	const selectedObject3d = useSelectedObject3d()
	const partConfig = usePartConfig()

	const mode = $derived(settings.current.transformMode)
	const entity = $derived(selectedEntity.current)
	const transformable = useTrait(() => entity, traits.Transformable)

	// Mesh sets name={entity} on its inner mesh, so useSelectedObject3d resolves
	// to that mesh — not the parent Frame Group we actually want to drive. Walk
	// up to the Group so translate/rotate/scale apply to the whole frame, not
	// the geometry inside it.
	const ref = $derived(selectedObject3d.current?.parent ?? selectedObject3d.current)

	const activeMode = $derived(mode === 'none' || !transformable.current ? undefined : mode)

	const quaternion = new Quaternion()
	const vector3 = new Vector3()
	const ov = new OrientationVector()

	const frameConfig = new FrameConfigUpdater(partConfig.updateFrame, partConfig.deleteFrame)

	// Captured at mouseDown so mouseUp removes the trait from the same entity
	// even if selection somehow changes mid-drag.
	let transformingEntity: typeof entity

	const onMouseDown = () => {
		transformingEntity = entity
		if (transformingEntity) transformingEntity.add(traits.Transforming)
		environment.current.viewerMode = 'edit'
		transformControls.setActive(true)
		onChange()
	}

	const onChange = () => {
		if (!ref || !entity || !activeMode) {
			return
		}

		const isFrameEntity = entity.has(traits.FramesAPI)

		if (activeMode === 'translate') {
			if (isFrameEntity) {
				// ref.position is local (meters); EditedPose stores mm.
				frameConfig.updateLocalPosition(entity, {
					x: ref.position.x * 1000,
					y: ref.position.y * 1000,
					z: ref.position.z * 1000,
				})
			} else {
				const pose = entity.get(traits.Pose)

				if (pose) {
					vector3ToPose(ref.getWorldPosition(vector3), pose)
					entity.set(traits.Pose, pose)
				}
			}
		} else if (activeMode === 'rotate') {
			if (isFrameEntity) {
				ov.setFromQuaternion(ref.quaternion)
				frameConfig.updateLocalOrientation(entity, {
					oX: ov.x,
					oY: ov.y,
					oZ: ov.z,
					theta: MathUtils.radToDeg(ov.th),
				})
			} else {
				const pose = entity.get(traits.Pose)
				if (pose) {
					quaternionToPose(ref.getWorldQuaternion(quaternion), pose)
					ref.quaternion.copy(quaternion)
					entity.set(traits.Pose, pose)
				}
			}
		} else {
			// scale → bake the gizmo's scale factor into the geometry trait,
			// then reset the object's scale so subsequent drags start from 1.
			const box = entity.get(traits.Box)
			const sphere = entity.get(traits.Sphere)
			const capsule = entity.get(traits.Capsule)

			if (box) {
				const next = {
					x: box.x * ref.scale.x,
					y: box.y * ref.scale.y,
					z: box.z * ref.scale.z,
				}
				if (isFrameEntity) {
					frameConfig.updateGeometry(entity, { type: 'box', ...next })
				} else {
					entity.set(traits.Box, next)
				}
			} else if (sphere) {
				const next = { r: sphere.r * ref.scale.x }
				if (isFrameEntity) {
					frameConfig.updateGeometry(entity, { type: 'sphere', ...next })
				} else {
					entity.set(traits.Sphere, next)
				}
			} else if (capsule) {
				const next = { r: capsule.r * ref.scale.x, l: capsule.l * ref.scale.y }
				if (isFrameEntity) {
					frameConfig.updateGeometry(entity, { type: 'capsule', ...next })
				} else {
					entity.set(traits.Capsule, next)
				}
			}

			ref.scale.setScalar(1)
		}
	}

	const onMouseUp = () => {
		transformingEntity?.remove(traits.Transforming)
		transformingEntity = undefined
		transformControls.setActive(false)
	}
</script>

{#if ref && entity && activeMode}
	<TransformControls
		object={ref}
		mode={activeMode}
		translationSnap={settings.current.snapping ? 0.1 : undefined}
		rotationSnap={settings.current.snapping ? Math.PI / 24 : undefined}
		scaleSnap={settings.current.snapping ? 0.1 : undefined}
		onmouseDown={onMouseDown}
		onobjectChange={onChange}
		onmouseUp={onMouseUp}
	/>
{/if}

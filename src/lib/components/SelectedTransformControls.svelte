<script lang="ts">
	import { TransformControls } from '@threlte/extras'
	import { MathUtils, Quaternion, Vector3 } from 'three'

	import type { FrameEditSession } from '$lib/editing/FrameEditSession'

	import { traits, useTrait } from '$lib/ecs'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useFrameEditSession } from '$lib/hooks/useFrameEditSession.svelte'
	import { useSelectedEntity, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { OrientationVector } from '$lib/three/OrientationVector'
	import { quaternionToPose, vector3ToPose } from '$lib/transform'

	const settings = useSettings()
	const environment = useEnvironment()
	const transformControls = useTransformControls()
	const selectedEntity = useSelectedEntity()
	const selectedObject3d = useSelectedObject3d()
	const sessions = useFrameEditSession()

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

	let session: FrameEditSession | undefined

	const onMouseDown = () => {
		if (entity?.has(traits.FramesAPI)) {
			session = sessions.begin([entity])
		}
		environment.current.viewerMode = 'edit'
		transformControls.setActive(true)
	}

	const onChange = (event) => {
		console.log(event, ref, entity, activeMode)
		if (!ref || !entity || !activeMode) {
			return
		}

		const isFrameEntity = entity.has(traits.FramesAPI)

		if (activeMode === 'translate') {
			if (isFrameEntity) {
				// ref.position is local (meters); EditedPose stores mm.
				session?.stagePose(entity, {
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
				session?.stagePose(entity, {
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
					session?.stageGeometry(entity, { type: 'box', ...next })
				} else {
					entity.set(traits.Box, next)
				}
			} else if (sphere) {
				const next = { r: sphere.r * ref.scale.x }
				if (isFrameEntity) {
					session?.stageGeometry(entity, { type: 'sphere', ...next })
				} else {
					entity.set(traits.Sphere, next)
				}
			} else if (capsule) {
				const next = { r: capsule.r * ref.scale.x, l: capsule.l * ref.scale.y }
				if (isFrameEntity) {
					session?.stageGeometry(entity, { type: 'capsule', ...next })
				} else {
					entity.set(traits.Capsule, next)
				}
			}

			ref.scale.setScalar(1)
		}
	}

	const onMouseUp = () => {
		console.log('here')
		session?.commit()
		session = undefined
		transformControls.setActive(false)
	}
</script>

{#if ref && entity && activeMode}
	{#key entity}
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
	{/key}
{/if}

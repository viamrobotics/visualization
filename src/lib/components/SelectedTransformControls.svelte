<script lang="ts">
	import { TransformControls } from '@threlte/extras'
	import { Quaternion, Vector3 } from 'three'

	import type { FrameEditSession } from '$lib/editing/FrameEditSession'

	import { traits, useTrait } from '$lib/ecs'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useFrameEditSession } from '$lib/hooks/useFrameEditSession.svelte'
	import { useSelectedEntity, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import {
		composeEditedPoseForRenderedPose,
		createPose,
		quaternionToPose,
		vector3ToPose,
	} from '$lib/transform'

	const settings = useSettings()
	const environment = useEnvironment()
	const transformControls = useTransformControls()
	const selectedEntity = useSelectedEntity()
	const selectedObject3d = useSelectedObject3d()
	const sessions = useFrameEditSession()

	const mode = $derived(settings.current.transformMode)
	const entity = $derived(selectedEntity.current)
	const transformable = useTrait(() => entity, traits.Transformable)
	const networkPose = useTrait(() => entity, traits.Pose)
	const livePose = useTrait(() => entity, traits.LivePose)
	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)
	const hasScalableGeometry = $derived(
		box.current !== undefined || sphere.current !== undefined || capsule.current !== undefined
	)

	// Mesh sets name={entity} on its inner mesh, so useSelectedObject3d resolves
	// to that mesh — not the parent Frame Group we actually want to drive. Walk
	// up to the Group so translate/rotate/scale apply to the whole frame, not
	// the geometry inside it.
	const ref = $derived(selectedObject3d.current?.parent ?? selectedObject3d.current)

	const activeMode = $derived.by(() => {
		if (mode === 'none' || !transformable.current) return undefined
		// Scale only does anything for primitive geometries the gizmo can size.
		if (mode === 'scale' && !hasScalableGeometry) return undefined
		return mode
	})
	const isSphereScale = $derived(activeMode === 'scale' && sphere.current !== undefined)
	const isCapsuleScale = $derived(activeMode === 'scale' && capsule.current !== undefined)

	const quaternion = new Quaternion()
	const vector3 = new Vector3()
	const refPose = createPose()

	let session: FrameEditSession | undefined
	let scaleStart:
		| { type: 'box'; x: number; y: number; z: number }
		| { type: 'sphere'; r: number }
		| { type: 'capsule'; r: number; l: number }
		| undefined

	const captureScaleStart = () => {
		if (!entity || activeMode !== 'scale') {
			scaleStart = undefined
			return
		}

		const box = entity.get(traits.Box)
		if (box) {
			scaleStart = { type: 'box', ...box }
			return
		}

		const sphere = entity.get(traits.Sphere)
		if (sphere) {
			scaleStart = { type: 'sphere', ...sphere }
			return
		}

		const capsule = entity.get(traits.Capsule)
		if (capsule) {
			scaleStart = { type: 'capsule', ...capsule }
			return
		}

		scaleStart = undefined
	}

	const onMouseDown = () => {
		if (entity?.has(traits.FramesAPI)) {
			session = sessions.begin([entity])
		}
		captureScaleStart()
		environment.current.viewerMode = 'edit'
		transformControls.setActive(true)
	}

	const onChange = () => {
		if (!ref || !entity || !activeMode) {
			return
		}

		const isFrameEntity = entity.has(traits.FramesAPI)

		if (activeMode === 'translate' || activeMode === 'rotate') {
			if (isFrameEntity) {
				stageFrameTransform()
			} else {
				const pose = entity.get(traits.Pose)
				if (pose) {
					if (activeMode === 'translate') {
						vector3ToPose(ref.getWorldPosition(vector3), pose)
					} else {
						quaternionToPose(ref.getWorldQuaternion(quaternion), pose)
						ref.quaternion.copy(quaternion)
					}
					entity.set(traits.Pose, pose)
				}
			}
		} else {
			// scale → bake the gizmo's scale factor into the geometry trait,
			// then reset the object's scale so subsequent drags start from 1.
			if (!scaleStart) {
				captureScaleStart()
			}

			if (scaleStart?.type === 'box') {
				const next = {
					x: scaleStart.x * ref.scale.x,
					y: scaleStart.y * ref.scale.y,
					z: scaleStart.z * ref.scale.z,
				}
				if (isFrameEntity) {
					session?.stageGeometry(entity, { type: 'box', ...next })
				} else {
					entity.set(traits.Box, next)
				}
			} else if (scaleStart?.type === 'sphere') {
				const next = { r: scaleStart.r * ref.scale.x }
				if (isFrameEntity) {
					session?.stageGeometry(entity, { type: 'sphere', ...next })
				} else {
					entity.set(traits.Sphere, next)
				}
			} else if (scaleStart?.type === 'capsule') {
				const next = { r: scaleStart.r * ref.scale.x, l: scaleStart.l * ref.scale.y }
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
		session?.commit()
		session = undefined
		scaleStart = undefined
		transformControls.setActive(false)
	}

	// Pose.svelte renders frame entities through the live blend
	//   render = M(live) × M(network)⁻¹ × M(edited)
	// so for the user's drag to render where they pulled the gizmo to, EditedPose
	// must satisfy
	//   M(edited) = M(network) × M(live)⁻¹ × M(ref)
	// where M(ref) is the gizmo-driven group's parent-relative matrix in mm.
	// When live ≈ network (no kinematic offset), this collapses to M(edited) =
	// M(ref) — the same as the naive writeback. When they diverge (e.g. an arm
	// whose joints have moved away from its config pose), this composition is
	// what keeps the rendering anchored to the user's pointer instead of
	// shearing through the live × baseline⁻¹ offset.
	const stageFrameTransform = () => {
		if (!ref || !entity) return

		vector3ToPose(ref.position, refPose)
		quaternionToPose(ref.quaternion, refPose)

		const live = livePose.current
		const network = networkPose.current

		if (!live || !network) {
			// No live pose available — Pose.svelte's blend short-circuits to
			// editedPose, so naive writeback is correct.
			if (activeMode === 'translate') {
				session?.stagePose(entity, {
					x: refPose.x,
					y: refPose.y,
					z: refPose.z,
				})
			} else if (activeMode === 'rotate') {
				session?.stagePose(entity, {
					oX: refPose.oX,
					oY: refPose.oY,
					oZ: refPose.oZ,
					theta: refPose.theta,
				})
			}
			return
		}

		session?.stagePose(entity, composeEditedPoseForRenderedPose(network, live, refPose))
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
			showY={!isSphereScale}
			showZ={!isSphereScale && !isCapsuleScale}
			onmouseDown={onMouseDown}
			onobjectChange={onChange}
			onmouseUp={onMouseUp}
		/>
	{/key}
{/if}

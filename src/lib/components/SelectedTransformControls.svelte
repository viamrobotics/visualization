<script lang="ts">
	import type { TransformControls as ThreeTransformControls } from 'three/addons/controls/TransformControls.js'

	import { T, useThrelte } from '@threlte/core'
	import { TransformControls } from '@threlte/extras'
	import { onDestroy } from 'svelte'
	import { Matrix4, Vector3 } from 'three'

	import {
		boundsHintInterior,
		type BoundsInterior,
		boundsObstacleNamed,
		resizeBoundsObstacle,
	} from '$lib/boundsObstacleInterior'
	import { complexShapeOwner } from '$lib/complexShapeOwner'
	import { relations, traits, useQuery, useTrait } from '$lib/ecs'
	import { FrameEditor } from '$lib/editing/FrameEditor'
	import { shapeOffsetFromGizmo, withObstacleShapePatch } from '$lib/editing/obstacleShapeGizmo'
	import { isFrameVariableLocked } from '$lib/frameVariableLocks'
	import { transformSnaps } from '$lib/hooks/transformSnaps'
	import { useConfigFrames } from '$lib/hooks/useConfigFrames.svelte'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useFragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { Pose } from '$lib/math'
	import { solveEditedMatrix } from '$lib/math/transform'
	import { type ObstacleShape } from '$lib/obstacleAttributes'
	import { type ObstacleGeometryPatch } from '$lib/obstacleGeometryList'
	import {
		simpleObstacleNamed,
		simpleObstacleShape,
		withSimpleObstacleShape,
	} from '$lib/simpleObstacleShape'
	import { isolateTransformControls } from '$lib/three/renderLayers'
	import { TransformGizmoAnchor } from '$lib/three/TransformGizmoAnchor'

	const { invalidate } = useThrelte()
	const settings = useSettings()
	const environment = useEnvironment()
	const fragmentInfo = useFragmentInfo()
	const configFrames = useConfigFrames()
	const transformControls = useTransformControls()
	const partConfig = usePartConfig()
	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)
	const selected = useQuery(traits.Selected)

	const mode = $derived(settings.current.transformMode)
	const snaps = $derived(transformSnaps(settings.current))
	const isBuildMode = $derived(environment.current.mode === 'build')
	const entity = $derived(selected.current[0])
	const editable = useTrait(() => entity, traits.Editable)
	const invisible = useTrait(() => entity, traits.InheritedInvisible)
	const configMatrix = useTrait(() => entity, traits.Matrix)
	const liveMatrix = useTrait(() => entity, traits.LiveMatrix)
	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)
	const name = useTrait(() => entity, traits.Name)
	const framesAPI = useTrait(() => entity, traits.FramesAPI)
	const center = useTrait(() => entity, traits.Center)
	const complexShape = useTrait(() => entity, traits.ComplexObstacleShape)
	// A Complex obstacle's shape is edited through its entry in the obstacle's attributes.
	const shapeOwner = $derived(
		complexShape.current
			? complexShapeOwner(partConfig.current.components, name.current)
			: undefined
	)
	// A Simple obstacle's own frame has no geometry, so the scale gizmo resizes its one shape.
	const simpleObstacle = $derived(simpleObstacleNamed(partConfig.current.components, name.current))
	const obstacleShape = $derived(simpleObstacle ? simpleObstacleShape(simpleObstacle) : undefined)
	// A Bounds obstacle's frame has no geometry either, so the scale gizmo resizes its interior.
	const boundsObstacle = $derived(boundsObstacleNamed(partConfig.current.components, name.current))
	const hasScalableGeometry = $derived(
		box.current !== undefined ||
			sphere.current !== undefined ||
			capsule.current !== undefined ||
			obstacleShape !== undefined ||
			boundsObstacle !== undefined
	)
	const isFragmentComponentWithVariables = $derived(
		name.current !== undefined &&
			isFrameVariableLocked(
				fragmentInfo.current?.[name.current],
				configFrames.effectiveFrames.get(name.current)
			)
	)

	// Non-mesh frames (reference frames, and instanced box/sphere/capsule frames)
	// render no named scene object, so `getObjectByName` can't locate a gizmo
	// target. Drive a dedicated anchor from the selected entity's WorldMatrix
	// instead, the same world transform the entity renderers compose.
	const UNIT_SCALE = new Vector3(1, 1, 1)
	const anchor = new TransformGizmoAnchor()
	const tempShapeCenter = new Matrix4()
	const tempShapeWorld = new Matrix4()

	$effect.pre(() => {
		const world = worldMatrix.current
		if (!world) return

		// A Complex shape's frame sits at the obstacle origin, so the gizmo goes to the shape itself.
		if (shapeOwner && center.current) {
			new Pose().copy(center.current).toMatrix4(tempShapeCenter)
			anchor.syncTo(tempShapeWorld.multiplyMatrices(world, tempShapeCenter))
		} else {
			anchor.syncTo(world)
		}
		invalidate()
	})

	const ref = $derived(worldMatrix.current ? anchor : undefined)

	const activeMode = $derived.by<'translate' | 'rotate' | 'scale' | undefined>(() => {
		if (mode === 'none' || !(editable.current || shapeOwner)) return

		// Scale only does anything for primitive geometries the gizmo can size.
		if (mode === 'scale' && !hasScalableGeometry) return

		return mode
	})
	const isSphereScale = $derived(
		activeMode === 'scale' && (sphere.current !== undefined || obstacleShape?.type === 'sphere')
	)
	const isCapsuleScale = $derived(
		activeMode === 'scale' && (capsule.current !== undefined || obstacleShape?.type === 'capsule')
	)

	/**
	 * A frame drag is only ever staged through the part config, so without edit
	 * permissions every change is discarded — `updatePartFrame` finds no matching
	 * component and returns, leaving the frame visibly moved but nothing dirtied.
	 * Withhold the gizmo rather than offering an edit that can't land. Non-frame
	 * entities (drawings, tool gizmos) stage straight into `Matrix` and never
	 * touch the config, so they stay draggable.
	 */
	const isFrameEntity = $derived(framesAPI.current !== undefined)
	const canEdit = $derived(!isFrameEntity || partConfig.hasEditPermissions)

	const transforming = $derived(
		isBuildMode &&
			ref &&
			entity &&
			activeMode &&
			canEdit &&
			!isFragmentComponentWithVariables &&
			!invisible.current
	)

	const refPose = new Pose()
	const tempRefMatrix = new Matrix4()
	const tempEditedMatrix = new Matrix4()
	const tempParentInverse = new Matrix4()
	const tempPose = new Pose()

	let scaleStart:
		| { type: 'box'; x: number; y: number; z: number }
		| { type: 'sphere'; r: number }
		| { type: 'capsule'; r: number; l: number }
		| undefined
	let frameHistoryEntryOpen = false
	let controls = $state.raw<ThreeTransformControls>()

	$effect(() => {
		if (controls) isolateTransformControls(controls)
	})

	const beginFrameHistoryEntry = () => {
		if (!isFrameEntity) return
		partConfig.beginFrameEditHistoryEntry()
		frameHistoryEntryOpen = true
	}

	const endFrameHistoryEntry = () => {
		if (!frameHistoryEntryOpen) return
		partConfig.endFrameEditHistoryEntry()
		frameHistoryEntryOpen = false
	}

	onDestroy(endFrameHistoryEntry)

	const captureScaleStart = () => {
		if (!entity || activeMode !== 'scale') {
			scaleStart = undefined
			return
		}

		if (obstacleShape) {
			scaleStart = { ...obstacleShape }
			return
		}

		if (boundsObstacle) {
			scaleStart = { type: 'box', ...boundsHintInterior(boundsObstacle.hint) }
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

	const resizeSimpleObstacle = (obstacle: PartComponent, shape: ObstacleShape) => {
		partConfig.updateComponent(obstacle.name, {
			attributes: withSimpleObstacleShape(obstacle, shape),
		})
	}

	const resizeBounds = (interior: BoundsInterior) => {
		if (!boundsObstacle) return
		const { component, hint } = boundsObstacle
		partConfig.updateComponent(component.name, resizeBoundsObstacle(component, hint, interior))
	}

	const patchComplexShape = (patch: ObstacleGeometryPatch) => {
		if (!shapeOwner || !complexShape.current) return
		partConfig.updateComponent(shapeOwner.name, {
			attributes: withObstacleShapePatch(shapeOwner, complexShape.current.index, patch),
		})
	}

	/** Writes a translate/rotate drag of a Complex shape back as that shape's offset. */
	const stageComplexShapeTransform = () => {
		const world = worldMatrix.current
		if (!ref || !world) return

		tempShapeWorld.compose(ref.position, ref.quaternion, UNIT_SCALE)
		const offset = shapeOffsetFromGizmo(world, tempShapeWorld)

		if (activeMode === 'translate') {
			patchComplexShape({ translation: { x: offset.x, y: offset.y, z: offset.z } })
		} else {
			patchComplexShape({
				orientation: {
					type: 'ov_degrees',
					value: { x: offset.oX, y: offset.oY, z: offset.oZ, th: offset.theta },
				},
			})
		}
	}

	const onMouseDown = () => {
		captureScaleStart()
		beginFrameHistoryEntry()

		transformControls.setActive(true)
	}

	const onChange = () => {
		if (!ref || !entity || !activeMode) return

		if (activeMode === 'translate' || activeMode === 'rotate') {
			if (shapeOwner) {
				stageComplexShapeTransform()
			} else if (isFrameEntity) {
				stageFrameTransform()
			} else {
				stageLocalTransform()
			}
		} else {
			// scale → bake the gizmo's scale factor into the geometry trait,
			// then reset the object's scale so subsequent drags start from 1.
			if (!scaleStart) {
				captureScaleStart()
			}

			// Clamp at 0 — the gizmo can produce negative scale factors when
			// dragged past the origin, which would yield negative dimensions
			// and a degenerate OBB.
			if (scaleStart?.type === 'box') {
				const next = {
					x: Math.max(0, scaleStart.x * ref.scale.x),
					y: Math.max(0, scaleStart.y * ref.scale.y),
					z: Math.max(0, scaleStart.z * ref.scale.z),
				}
				if (simpleObstacle) {
					resizeSimpleObstacle(simpleObstacle, { type: 'box', ...next })
				} else if (boundsObstacle) {
					resizeBounds(next)
				} else if (shapeOwner) {
					patchComplexShape({ type: 'box', ...next })
				} else if (isFrameEntity) {
					frameEditor.setGeometry(entity, { type: 'box', ...next })
				} else {
					entity.set(traits.Box, next)
				}
			} else if (scaleStart?.type === 'sphere') {
				const next = { r: Math.max(0, scaleStart.r * ref.scale.x) }
				if (simpleObstacle) {
					resizeSimpleObstacle(simpleObstacle, { type: 'sphere', ...next })
				} else if (shapeOwner) {
					patchComplexShape({ type: 'sphere', ...next })
				} else if (isFrameEntity) {
					frameEditor.setGeometry(entity, { type: 'sphere', ...next })
				} else {
					entity.set(traits.Sphere, next)
				}
			} else if (scaleStart?.type === 'capsule') {
				const next = {
					r: Math.max(0, scaleStart.r * ref.scale.x),
					l: Math.max(0, scaleStart.l * ref.scale.y),
				}
				if (simpleObstacle) {
					resizeSimpleObstacle(simpleObstacle, { type: 'capsule', ...next })
				} else if (shapeOwner) {
					patchComplexShape({ type: 'capsule', ...next })
				} else if (isFrameEntity) {
					frameEditor.setGeometry(entity, { type: 'capsule', ...next })
				} else {
					entity.set(traits.Capsule, next)
				}
			}

			ref.scale.setScalar(1)
		}
	}

	const onMouseUp = () => {
		scaleStart = undefined
		transformControls.setActive(false)
		endFrameHistoryEntry()
	}

	/**
	 * Build the entity's parent-relative drag target from the gizmo's world-space
	 * `ref` transform into `out`.
	 *
	 * Entity renderers mount at the scene root with `matrixAutoUpdate = false`
	 * and recompose `group.matrix` from the `WorldMatrix` trait, so
	 * `ref.position` / `ref.quaternion` are world-space. Matrix-shaped traits
	 * store local-to-parent, so we left-multiply by the parent's inverted
	 * WorldMatrix. Otherwise recomposition (parentWorld × local) re-applies the
	 * parent transform and the entity lands at parentWorld × where-it-was-dragged.
	 */
	const computeLocalDragTarget = (out: Matrix4) => {
		if (!ref || !entity) return

		out.makeRotationFromQuaternion(ref.quaternion)
		out.setPosition(ref.position)

		const parentWorld = entity.targetFor(relations.ChildOf)?.get(traits.WorldMatrix)
		if (parentWorld) {
			tempParentInverse.copy(parentWorld).invert()
			out.premultiply(tempParentInverse)
		}
	}

	/**
	 * Applies a translate/rotate drag for a frame system entity. With a kinematic
	 * offset (LiveMatrix + Matrix both present), the parent-relative target feeds
	 * solveEditedMatrix to back out the EditedMatrix satisfying
	 * live × baseline⁻¹ × edited = local. Without one, `toLocalMatrix` in
	 * `$lib/ecs/worldMatrix.ts` short-circuits to EditedMatrix, so we write the
	 * target pose directly.
	 */
	const stageFrameTransform = () => {
		if (!ref || !entity) return

		computeLocalDragTarget(tempRefMatrix)
		refPose.setFromMatrix4(tempRefMatrix)

		const live = liveMatrix.current
		const config = configMatrix.current

		if (!live || !config) {
			if (activeMode === 'translate') {
				frameEditor.setPose(entity, {
					x: refPose.x,
					y: refPose.y,
					z: refPose.z,
				})
			} else if (activeMode === 'rotate') {
				frameEditor.setPose(entity, {
					oX: refPose.oX,
					oY: refPose.oY,
					oZ: refPose.oZ,
					theta: refPose.theta,
				})
			}
			return
		}

		solveEditedMatrix(config, live, tempRefMatrix, tempEditedMatrix)

		tempPose.setFromMatrix4(tempEditedMatrix)

		frameEditor.setPose(entity, { ...tempPose })
	}

	/**
	 * Stages a translate/rotate drag for a non-frame-system entity (e.g. a gizmo)
	 * by writing the dragged component into the Matrix trait. Gizmos carry no
	 * LiveMatrix, so there's no live-pose blend to invert — the parent-relative
	 * target is the new local transform.
	 */
	const stageLocalTransform = () => {
		if (!ref || !entity) return

		const matrix = entity.get(traits.Matrix)
		if (!matrix) return

		computeLocalDragTarget(tempRefMatrix)

		tempPose.setFromMatrix4(matrix)
		refPose.setFromMatrix4(tempRefMatrix)

		if (activeMode === 'translate') {
			tempPose.x = refPose.x
			tempPose.y = refPose.y
			tempPose.z = refPose.z
		} else {
			tempPose.oX = refPose.oX
			tempPose.oY = refPose.oY
			tempPose.oZ = refPose.oZ
			tempPose.theta = refPose.theta
		}

		tempPose.toMatrix4(matrix)
		entity.changed(traits.Matrix)
	}
</script>

{#if transforming}
	<T
		is={anchor}
		dispose={false}
	/>
	{#key entity}
		<TransformControls
			bind:controls
			object={ref}
			mode={activeMode}
			space={settings.current.transformSpace}
			translationSnap={snaps.translation}
			rotationSnap={snaps.rotation}
			scaleSnap={snaps.scale}
			showY={!isSphereScale}
			showZ={!isSphereScale && !isCapsuleScale}
			onmouseDown={onMouseDown}
			onobjectChange={onChange}
			onmouseUp={onMouseUp}
		/>
	{/key}
{/if}

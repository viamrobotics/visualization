<script lang="ts">
	import type { Entity } from 'koota'
	import type { TransformControls as ThreeTransformControls } from 'three/addons/controls/TransformControls.js'

	import { T, useThrelte } from '@threlte/core/webgpu'
	import { TransformControls } from '@threlte/extras/webgpu'
	import { Group, Matrix4, Quaternion, Vector3 } from 'three'

	import {
		boundsHintInterior,
		boundsObstacleNamed,
		resizeBoundsObstacle,
	} from '#lib/boundsObstacleInterior.js'
	import { complexShapeOwner } from '#lib/complexShapeOwner.js'
	import SnapIndicator from '#lib/components/SnapIndicator.svelte'
	import { relations, traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { FrameEditor } from '#lib/editing/FrameEditor.js'
	import { type ScalableGeometry, scaledGeometry, scaleHandles } from '#lib/editing/gizmoScale.js'
	import { centroidOf, dragDelta, outermostEntities } from '#lib/editing/groupTransform.js'
	import {
		shapeOffsetFromGizmo,
		withObstacleShapePatches,
	} from '#lib/editing/obstacleShapeGizmo.js'
	import { isFrameVariableLocked } from '#lib/frameVariableLocks.js'
	import { transformSnaps } from '#lib/hooks/transformSnaps.js'
	import { useConfigFrames } from '#lib/hooks/useConfigFrames.svelte.js'
	import { useTransformControls } from '#lib/hooks/useControls.svelte.js'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { useFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { useSelectionOrder } from '#lib/hooks/useSelectionOrder.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'
	import { Pose } from '#lib/math/index.js'
	import { solveEditedMatrix } from '#lib/math/transform.js'
	import { type ObstacleGeometryPatch } from '#lib/obstacleGeometryList.js'
	import {
		simpleObstacleNamed,
		simpleObstacleShape,
		withSimpleObstacleShape,
	} from '#lib/simpleObstacleShape.js'
	import { useObjectSnapDrag } from '#lib/snapping/useObjectSnapDrag.svelte.js'
	import { isolateTransformControls } from '#lib/three/renderLayers.js'

	const { invalidate } = useThrelte()
	const settings = useSettings()
	const environment = useEnvironment()
	const fragmentInfo = useFragmentInfo()
	const configFrames = useConfigFrames()
	const transformControls = useTransformControls()
	const partConfig = usePartConfig()
	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)
	const selection = useSelectionOrder()

	const mode = $derived(settings.current.transformMode)
	const objectSnap = useObjectSnapDrag()
	const snaps = $derived(
		transformSnaps({
			...settings.current,
			snapping: settings.current.snapping !== objectSnap.isInverted,
		})
	)
	const isBuildMode = $derived(environment.current.mode === 'build')

	// Blender's model: the first selected object carries the gizmo and lends it its axes.
	const first = $derived(selection.current[0])
	const movers = $derived(outermostEntities(selection.current))
	const isGroup = $derived(movers.length > 1)
	// Remounts the controls when the selection changes. Ids, since callers pass fresh arrays.
	const selectionKey = $derived(movers.join(','))

	const targets = useMappedEntitiesTraits(
		() => movers,
		[
			traits.Name,
			traits.Editable,
			traits.InheritedInvisible,
			traits.FramesAPI,
			traits.Box,
			traits.Sphere,
			traits.Capsule,
			traits.ComplexObstacleShape,
		],
		(entity) => {
			const name = entity.get(traits.Name)
			const components = partConfig.current.components
			const complexShape = entity.get(traits.ComplexObstacleShape)
			// A Complex obstacle's shape is edited through its entry in the obstacle's attributes.
			const shapeOwner = complexShape ? complexShapeOwner(components, name) : undefined
			// A Simple obstacle's own frame has no geometry, so the scale gizmo resizes its one shape.
			const simpleObstacle = simpleObstacleNamed(components, name)
			const obstacleShape = simpleObstacle ? simpleObstacleShape(simpleObstacle) : undefined
			// A Bounds obstacle's frame has no geometry either, so the scale gizmo resizes its interior.
			const boundsObstacle = boundsObstacleNamed(components, name)

			return {
				entity,
				complexShape,
				shapeOwner,
				simpleObstacle,
				boundsObstacle,
				isMovable: entity.has(traits.Editable) || !!shapeOwner,
				isInvisible: entity.has(traits.InheritedInvisible),
				isFrame: entity.has(traits.FramesAPI),
				isFragmentLocked:
					name !== undefined &&
					isFrameVariableLocked(
						fragmentInfo.current?.[name],
						configFrames.effectiveFrames.get(name)
					),
				geometry: scalableGeometryOf(entity, obstacleShape, boundsObstacle),
			}
		}
	)

	type Target = (typeof targets.current)[number]

	function scalableGeometryOf(
		entity: Entity,
		obstacleShape: ScalableGeometry | undefined,
		boundsObstacle: ReturnType<typeof boundsObstacleNamed>
	): ScalableGeometry | undefined {
		if (obstacleShape) return { ...obstacleShape }
		if (boundsObstacle) return { type: 'box', ...boundsHintInterior(boundsObstacle.hint) }

		const box = entity.get(traits.Box)
		if (box) return { type: 'box', ...box }
		const sphere = entity.get(traits.Sphere)
		if (sphere) return { type: 'sphere', ...sphere }
		const capsule = entity.get(traits.Capsule)
		if (capsule) return { type: 'capsule', ...capsule }
		return undefined
	}

	const UNIT_SCALE = new Vector3(1, 1, 1)
	const tempShapeCenter = new Matrix4()
	const tempDecomposedPosition = new Vector3()
	const tempDecomposedScale = new Vector3()

	/**
	 * Where the gizmo grabs an entity, with unit scale: its world transform, or for a
	 * Complex shape, whose frame sits at the obstacle origin, the shape itself.
	 */
	const gizmoWorldOf = (entity: Entity, isComplexShape: boolean): Matrix4 | undefined => {
		const world = entity.get(traits.WorldMatrix)
		if (!world) return undefined

		const target = world.clone()
		const center = entity.get(traits.Center)
		if (isComplexShape && center) {
			target.multiply(new Pose().copy(center).toMatrix4(tempShapeCenter))
		}

		const orientation = new Quaternion()
		target.decompose(tempDecomposedPosition, orientation, tempDecomposedScale)
		return target.compose(tempDecomposedPosition, orientation, UNIT_SCALE)
	}

	const isComplexShapeTarget = (target: Target | undefined) =>
		!!target?.shapeOwner && !!target.complexShape

	/**
	 * Whether the gizmo grabs `entity` by its Complex obstacle shape. Read from the entity
	 * itself, since the first selected entity need not be one the gizmo moves.
	 */
	const isComplexShape = (entity: Entity) =>
		entity.has(traits.ComplexObstacleShape) &&
		!!complexShapeOwner(partConfig.current.components, entity.get(traits.Name))

	const gizmoWorldTraits = [
		traits.WorldMatrix,
		traits.Center,
		traits.ComplexObstacleShape,
		traits.Name,
	]
	const gizmoWorlds = useMappedEntitiesTraits(
		() => movers,
		gizmoWorldTraits,
		(entity) => gizmoWorldOf(entity, isComplexShape(entity))
	)
	const firstGizmoWorld = useMappedEntitiesTraits(
		() => (first ? [first] : []),
		gizmoWorldTraits,
		(entity) => gizmoWorldOf(entity, isComplexShape(entity))
	)

	// Non-mesh frames (reference frames, and instanced box/sphere/capsule frames)
	// render no named scene object, so `getObjectByName` can't locate a gizmo
	// target. Drive a dedicated anchor from the selection's WorldMatrix
	// instead, the same world transform the entity renderers compose.
	// Unlike those renderers, it keeps `matrixAutoUpdate` on: world-space snapping
	// reads `getWorldPosition()`, so a stale matrix snaps every drag back to its start.
	const anchor = new Group()

	const isWorldSpace = $derived(settings.current.transformSpace === 'world')

	$effect.pre(() => {
		const firstWorld = firstGizmoWorld.current[0]
		// Mid-drag, Three.js owns the gizmo. Re-deriving it from the staged poses would fight its snapping.
		if (!firstWorld || isGizmoDragging) return

		firstWorld.decompose(anchor.position, anchor.quaternion, anchor.scale)
		// World axes favor no object, so a group pivots on its centroid. Local axes come from
		// the first object, so it pivots there, which is where the gizmo says it does.
		const worlds = gizmoWorlds.current.filter((world) => world !== undefined)
		if (isWorldSpace && isGroup) centroidOf(worlds, anchor.position)
		// An aligned move stages a turn, which would otherwise tilt the gizmo mid-drag.
		if (objectSnap.isDragging) anchor.quaternion.copy(objectSnap.startOrientation)
		anchor.updateMatrixWorld()
		invalidate()
	})

	const ref = $derived(firstGizmoWorld.current[0] ? anchor : undefined)

	const isEveryScalable = $derived(targets.current.every((target) => target.geometry))

	const activeMode = $derived.by<'translate' | 'rotate' | 'scale' | undefined>(() => {
		if (mode === 'none' || !targets.current.every((target) => target.isMovable)) return

		// Scale only does anything for primitive geometries the gizmo can size.
		if (mode === 'scale' && !isEveryScalable) return

		return mode
	})

	/** The orientation a drag stages: the gizmo's own, or during a move, the snap's. */
	const stagedOrientation = (gizmo: Group) =>
		activeMode === 'translate' && objectSnap.isDragging ? objectSnap.orientation : gizmo.quaternion

	// A rotate orbits a group's other members about the pivot, so it moves them as well.
	const stagesPosition = $derived(
		activeMode === 'translate' || (activeMode === 'rotate' && isGroup)
	)
	// Align-to-surface turns the object during a move, so a move writes orientation too.
	const stagesOrientation = $derived(
		activeMode === 'rotate' || (activeMode === 'translate' && objectSnap.hasTurned)
	)

	// The first selected object sets the gizmo's axes, even when it isn't moved itself.
	const gizmoOrientation = $derived.by(() => {
		const firstWorld = firstGizmoWorld.current[0]
		return firstWorld ? new Quaternion().setFromRotationMatrix(firstWorld) : new Quaternion()
	})

	// `targets` and `gizmoWorlds` both map `movers`, so an index names the same entity in each.
	const handles = $derived(
		scaleHandles(
			targets.current.flatMap((target, index) => {
				const world = gizmoWorlds.current[index]
				return target.geometry && world
					? [
							{
								geometry: target.geometry,
								orientation: new Quaternion().setFromRotationMatrix(world),
							},
						]
					: []
			}),
			gizmoOrientation
		)
	)

	/**
	 * A frame drag is only ever staged through the part config, so without edit
	 * permissions every change is discarded — `updatePartFrame` finds no matching
	 * component and returns, leaving the frame visibly moved but nothing dirtied.
	 * Withhold the gizmo rather than offering an edit that can't land. Non-frame
	 * entities (drawings, tool gizmos) stage straight into `Matrix` and never
	 * touch the config, so they stay draggable.
	 */
	const canEdit = $derived(
		targets.current.every((target) => !target.isFrame || partConfig.hasEditPermissions)
	)

	// Every selected object must be movable, or the scene would show a group move that only part of it made.
	const transforming = $derived(
		isBuildMode &&
			ref &&
			movers.length > 0 &&
			activeMode &&
			canEdit &&
			!targets.current.some((target) => target.isFragmentLocked || target.isInvisible)
	)

	// Aligning several objects to one surface is ill-defined, so object snap is for one at a time.
	const usesObjectSnap = $derived(activeMode === 'translate' && !isGroup)

	const tempGizmoWorld = new Matrix4()
	const tempGizmoStart = new Matrix4()
	const tempDelta = new Matrix4()
	const tempTargetWorld = new Matrix4()
	const tempLocal = new Matrix4()
	const tempEditedMatrix = new Matrix4()
	const tempParentInverse = new Matrix4()
	const refPose = new Pose()
	const tempPose = new Pose()

	interface DragStart {
		target: Target
		/** Where the gizmo grabbed the entity when the drag began, with unit scale. */
		world: Matrix4
	}

	let dragStarts: DragStart[] = []
	let frameHistoryEntryOpen = false
	// State, so the anchor re-derives from the selection once a drag ends.
	let isGizmoDragging = $state(false)
	let controls = $state.raw<ThreeTransformControls>()

	$effect(() => {
		if (controls) isolateTransformControls(controls)
	})

	const beginFrameHistoryEntry = () => {
		if (!targets.current.some((target) => target.isFrame)) return
		partConfig.beginFrameEditHistoryEntry()
		frameHistoryEntryOpen = true
	}

	const endFrameHistoryEntry = () => {
		if (!frameHistoryEntryOpen) return
		partConfig.endFrameEditHistoryEntry()
		frameHistoryEntryOpen = false
	}

	const releaseGizmo = () => {
		if (!isGizmoDragging) return
		isGizmoDragging = false
		transformControls.setActive(false)
	}

	// The gizmo can unmount mid-drag, on a mode hotkey or the selection hiding, and then never sees
	// the pointer up. Close the history entry and release the camera with it, or undo stays blocked
	// behind the open entry and the camera stays parked.
	$effect(() => {
		if (!transforming || !selectionKey) return
		return () => {
			endFrameHistoryEntry()
			releaseGizmo()
		}
	})

	// Same unmount, plus a switch out of translate mid-drag. End the snap drag with them, or the
	// next drag starts from a stale one.
	$effect(() => {
		if (!transforming || !usesObjectSnap || !selectionKey) return
		return () => objectSnap.end()
	})

	/**
	 * Complex shape edits from the current drag step, keyed by obstacle and then by shape index.
	 * `flushShapePatches` writes each obstacle once, so two shapes of one obstacle both move.
	 */
	const pendingShapePatches = new Map<
		string,
		{ owner: NonNullable<Target['shapeOwner']>; patches: Map<number, ObstacleGeometryPatch> }
	>()

	const patchComplexShape = (target: Target, patch: ObstacleGeometryPatch) => {
		if (!target.shapeOwner || !target.complexShape) return

		const pending = pendingShapePatches.get(target.shapeOwner.name) ?? {
			owner: target.shapeOwner,
			patches: new Map<number, ObstacleGeometryPatch>(),
		}
		pending.patches.set(target.complexShape.index, patch)
		pendingShapePatches.set(target.shapeOwner.name, pending)
	}

	const flushShapePatches = () => {
		if (pendingShapePatches.size === 0) return

		partConfig.updateComponents(
			new Map(
				[...pendingShapePatches.values()].map(({ owner, patches }) => [
					owner.name,
					{ attributes: withObstacleShapePatches(owner, patches) },
				])
			)
		)
		pendingShapePatches.clear()
	}

	const onMouseDown = () => {
		if (!ref) return

		// Captured before the snap drag begins, while the gizmo still sits where the selection does.
		tempGizmoStart.compose(ref.position, ref.quaternion, UNIT_SCALE)
		dragStarts = targets.current.flatMap((target, index) => {
			const world = gizmoWorlds.current[index]
			return world ? [{ target, world: world.clone() }] : []
		})

		beginFrameHistoryEntry()
		if (usesObjectSnap && first) objectSnap.begin(first, ref)

		isGizmoDragging = true
		transformControls.setActive(true)
	}

	const onChange = () => {
		if (!ref || !activeMode) return

		if (activeMode === 'scale') {
			stageScale(ref.scale)
			// Three.js reports the factor since drag start, so each step resizes from the start.
			ref.scale.setScalar(1)
			return
		}

		if (usesObjectSnap && controls?.axis) objectSnap.apply(ref, controls.axis)

		tempGizmoWorld.compose(ref.position, stagedOrientation(ref), UNIT_SCALE)
		dragDelta(tempGizmoStart, tempGizmoWorld, tempDelta)

		for (const start of dragStarts) {
			tempTargetWorld.multiplyMatrices(tempDelta, start.world)
			stagePose(start.target, tempTargetWorld)
		}
		flushShapePatches()
	}

	const onMouseUp = () => {
		dragStarts = []
		objectSnap.end()
		releaseGizmo()
		endFrameHistoryEntry()
	}

	/** Moves one entity so the gizmo grabs it at `targetWorld`. */
	const stagePose = (target: Target, targetWorld: Matrix4) => {
		if (isComplexShapeTarget(target)) {
			stageComplexShapePose(target, targetWorld)
		} else if (target.isFrame) {
			stageFramePose(target.entity, targetWorld)
		} else {
			stageLocalPose(target.entity, targetWorld)
		}
	}

	const stageComplexShapePose = (target: Target, targetWorld: Matrix4) => {
		const world = target.entity.get(traits.WorldMatrix)
		if (!world) return

		const offset = shapeOffsetFromGizmo(world, targetWorld)
		patchComplexShape(target, {
			...(stagesPosition && { translation: { x: offset.x, y: offset.y, z: offset.z } }),
			...(stagesOrientation && {
				orientation: {
					type: 'ov_degrees',
					value: { x: offset.oX, y: offset.oY, z: offset.oZ, th: offset.theta },
				},
			}),
		})
	}

	/**
	 * Writes `entity`'s parent-relative transform for the world transform `targetWorld`
	 * into `out`.
	 *
	 * Entity renderers mount at the scene root with `matrixAutoUpdate = false`
	 * and recompose `group.matrix` from the `WorldMatrix` trait, so the gizmo works
	 * in world space. Matrix-shaped traits store local-to-parent, so we left-multiply
	 * by the parent's inverted WorldMatrix. Otherwise recomposition (parentWorld × local)
	 * re-applies the parent transform and the entity lands at parentWorld × where-it-was-dragged.
	 */
	const localTargetOf = (entity: Entity, targetWorld: Matrix4, out: Matrix4) => {
		out.copy(targetWorld)

		const parentWorld = entity.targetFor(relations.ChildOf)?.get(traits.WorldMatrix)
		if (parentWorld) {
			tempParentInverse.copy(parentWorld).invert()
			out.premultiply(tempParentInverse)
		}
		return out
	}

	/**
	 * Applies a translate/rotate drag for a frame system entity. With a kinematic
	 * offset (LiveMatrix + Matrix both present), the parent-relative target feeds
	 * solveEditedMatrix to back out the EditedMatrix satisfying
	 * live × baseline⁻¹ × edited = local. Without one, `toLocalMatrix` in
	 * `#lib/ecs/worldMatrix.ts` short-circuits to EditedMatrix, so we write the
	 * target pose directly.
	 */
	const stageFramePose = (entity: Entity, targetWorld: Matrix4) => {
		localTargetOf(entity, targetWorld, tempLocal)
		refPose.setFromMatrix4(tempLocal)

		const live = entity.get(traits.LiveMatrix)
		const config = entity.get(traits.Matrix)

		if (!live || !config) {
			frameEditor.setPose(entity, {
				...(stagesPosition && { x: refPose.x, y: refPose.y, z: refPose.z }),
				...(stagesOrientation && {
					oX: refPose.oX,
					oY: refPose.oY,
					oZ: refPose.oZ,
					theta: refPose.theta,
				}),
			})
			return
		}

		solveEditedMatrix(config, live, tempLocal, tempEditedMatrix)
		tempPose.setFromMatrix4(tempEditedMatrix)
		frameEditor.setPose(entity, { ...tempPose })
	}

	/**
	 * Stages a translate/rotate drag for a non-frame-system entity (e.g. a gizmo)
	 * by writing the dragged component into the Matrix trait. Gizmos carry no
	 * LiveMatrix, so there's no live-pose blend to invert — the parent-relative
	 * target is the new local transform.
	 */
	const stageLocalPose = (entity: Entity, targetWorld: Matrix4) => {
		const matrix = entity.get(traits.Matrix)
		if (!matrix) return

		localTargetOf(entity, targetWorld, tempLocal)
		tempPose.setFromMatrix4(matrix)
		refPose.setFromMatrix4(tempLocal)

		if (stagesPosition) {
			tempPose.x = refPose.x
			tempPose.y = refPose.y
			tempPose.z = refPose.z
		}
		if (stagesOrientation) {
			tempPose.oX = refPose.oX
			tempPose.oY = refPose.oY
			tempPose.oZ = refPose.oZ
			tempPose.theta = refPose.theta
		}

		tempPose.toMatrix4(matrix)
		entity.changed(traits.Matrix)
	}

	/** Bakes the gizmo's scale factor into each geometry's own dimensions, leaving positions alone. */
	const stageScale = (factor: Vector3) => {
		for (const { target } of dragStarts) {
			if (!target.geometry) continue
			writeGeometry(target, scaledGeometry(target.geometry, factor, handles.isUniform))
		}
		flushShapePatches()
	}

	const writeGeometry = (target: Target, next: ScalableGeometry) => {
		const { entity, simpleObstacle, boundsObstacle } = target

		if (simpleObstacle) {
			partConfig.updateComponent(simpleObstacle.name, {
				attributes: withSimpleObstacleShape(simpleObstacle, next),
			})
		} else if (boundsObstacle && next.type === 'box') {
			partConfig.updateComponent(
				boundsObstacle.component.name,
				resizeBoundsObstacle(boundsObstacle.component, boundsObstacle.hint, next)
			)
		} else if (isComplexShapeTarget(target)) {
			patchComplexShape(target, next)
		} else if (target.isFrame) {
			frameEditor.setGeometry(entity, next)
		} else if (next.type === 'box') {
			entity.set(traits.Box, { x: next.x, y: next.y, z: next.z })
		} else if (next.type === 'sphere') {
			entity.set(traits.Sphere, { r: next.r })
		} else {
			entity.set(traits.Capsule, { r: next.r, l: next.l })
		}
	}
</script>

{#if transforming}
	<T
		is={anchor}
		dispose={false}
	/>
	{#key selectionKey}
		<TransformControls
			bind:controls
			object={ref}
			mode={activeMode}
			space={settings.current.transformSpace}
			translationSnap={snaps.translation}
			rotationSnap={snaps.rotation}
			scaleSnap={snaps.scale}
			showY={activeMode !== 'scale' || handles.showY}
			showZ={activeMode !== 'scale' || handles.showZ}
			onmouseDown={onMouseDown}
			onobjectChange={onChange}
			onmouseUp={onMouseUp}
		/>
	{/key}

	{#if objectSnap.indicator}
		<SnapIndicator indicator={objectSnap.indicator} />
	{/if}
{/if}

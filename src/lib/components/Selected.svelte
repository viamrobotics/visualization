<script lang="ts">
	import type { Entity } from 'koota'

	import { T, useTask, useThrelte } from '@threlte/core/webgpu'
	import { BatchedMesh, Box3, Matrix4 } from 'three'
	import { OBB } from 'three/addons/math/OBB.js'

	import { composeBoxMatrix } from '$lib/components/Entities/composeBoxMatrix'
	import { composeCapsuleBoundsMatrix } from '$lib/components/Entities/composeCapsuleMatrices'
	import { composeCylinderBoundsMatrix } from '$lib/components/Entities/composeCylinderMatrix'
	import { composeMeshBoundsMatrix } from '$lib/components/Entities/composeMeshMatrix'
	import { composeSphereBoundsMatrix } from '$lib/components/Entities/composeSphereMatrix'
	import { traits, useQuery } from '$lib/ecs'
	import { BatchedAxesHelpers } from '$lib/three/BatchedAxesHelper'
	import { OBBHelper } from '$lib/three/OBBHelper'

	const box3 = new Box3()
	const obb = new OBB()
	const matrix4 = new Matrix4()
	const previousHelperMatrix = new Matrix4()

	const { scene, invalidate } = useThrelte()
	const selected = useQuery(traits.Selected)

	const obbHelpers = $derived(selected.current.map((entity) => [entity, new OBBHelper()] as const))

	/**
	 * Geometry-less frames have no bounds to outline, so selecting one instead
	 * redraws the frame's axes on top of the scene — a thicker copy with depth
	 * testing off, so the axes read through whatever geometry surrounds them.
	 * Axis length matches `Entities/AxesHelpers.svelte` so the axes don't appear
	 * to change size when selected.
	 */
	const selectedAxes = new BatchedAxesHelpers({
		capacity: 16,
		linewidth: 5,
		depthTest: false,
		depthWrite: false,
		transparent: true,
	})
	selectedAxes.renderOrder = 999

	const axesInstances = new Map<Entity, { instance: number; world: Matrix4 }>()

	/** Helpers that have been drawn at least once, so a fresh one always renders. */
	const drawnHelpers = new WeakSet<OBBHelper>()

	/** Shows or moves the entity's selected axes, returning whether anything changed. */
	const showAxes = (entity: Entity, world: Matrix4): boolean => {
		const shown = axesInstances.get(entity)

		if (shown === undefined) {
			axesInstances.set(entity, {
				instance: selectedAxes.addHelper(world),
				world: world.clone(),
			})
			return true
		}

		if (shown.world.equals(world)) return false

		shown.world.copy(world)
		selectedAxes.setMatrixAt(shown.instance, world)
		return true
	}

	/** Removes the entity's selected axes, returning whether any were shown. */
	const hideAxes = (entity: Entity): boolean => {
		const shown = axesInstances.get(entity)

		if (shown === undefined) return false

		selectedAxes.removeHelper(shown.instance)
		axesInstances.delete(entity)
		return true
	}

	/**
	 * Point `obbHelper` at the entity's bounds, returning `false` when the entity
	 * has none to measure.
	 */
	const setHelperBounds = (entity: Entity, obbHelper: OBBHelper): boolean => {
		/**
		 * Boxes, capsules, cylinders, spheres, and parsed meshes all render
		 * batched, so the entity has no named scene object carrying geometry —
		 * derive the OBB straight from traits.
		 */
		if (
			composeBoxMatrix(entity, matrix4) ||
			composeCapsuleBoundsMatrix(entity, matrix4) ||
			composeCylinderBoundsMatrix(entity, matrix4) ||
			composeSphereBoundsMatrix(entity, matrix4) ||
			composeMeshBoundsMatrix(entity, matrix4)
		) {
			obbHelper.setFromMatrix4(matrix4)
			return true
		}

		// Reference frames render only an instanced axes helper (no named object)
		// and carry no primitive trait.
		const object = scene.getObjectByName(entity as unknown as string)
		if (!object) {
			return false
		}

		const instance = entity.get(traits.InstanceId)
		if (instance !== undefined && instance >= 0 && object instanceof BatchedMesh) {
			object.getBoundingBoxAt(instance, box3)
			obb.fromBox3(box3)
			obbHelper.setFromOBB(obb)
		} else {
			obbHelper.setFromObject(object)
		}

		return true
	}

	/**
	 * Re-measures the entity's outline and axes, returning whether either moved.
	 * Bounds can change outside the ECS, such as a model's meshes, so this runs
	 * every frame and the caller renders only on a change.
	 */
	const updateSelection = (entity: Entity, obbHelper: OBBHelper): boolean => {
		previousHelperMatrix.copy(obbHelper.matrix)
		const wasVisible = obbHelper.visible

		const hasBounds = setHelperBounds(entity, obbHelper)
		obbHelper.visible = hasBounds

		const isFirstDraw = !drawnHelpers.has(obbHelper)
		drawnHelpers.add(obbHelper)

		const outlineChanged =
			isFirstDraw || wasVisible !== hasBounds || !obbHelper.matrix.equals(previousHelperMatrix)

		const world = hasBounds ? undefined : entity.get(traits.WorldMatrix)
		const axesChanged = world ? showAxes(entity, world) : hideAxes(entity)

		return outlineChanged || axesChanged
	}

	$effect(() => {
		const stillSelected = new Set<Entity>(selected.current)

		let hidAny = false
		for (const entity of axesInstances.keys()) {
			if (!stillSelected.has(entity)) {
				hidAny = hideAxes(entity) || hidAny
			}
		}

		// The task stops once nothing is selected, so it can't render this removal itself.
		if (hidAny) invalidate()
	})

	useTask(
		() => {
			let changed = false
			for (const [entity, obbHelper] of obbHelpers) {
				changed = updateSelection(entity, obbHelper) || changed
			}

			if (changed) invalidate()
		},
		{
			running: () => selected.current.length > 0,
			autoInvalidate: false,
		}
	)
</script>

{#each obbHelpers as [entity, obbHelper] (entity)}
	<T
		is={obbHelper}
		raycast={() => null}
		bvh={{ enabled: false }}
	/>
{/each}

<T
	is={selectedAxes}
	raycast={() => null}
	bvh={{ enabled: false }}
/>

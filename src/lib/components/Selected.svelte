<script lang="ts">
	import type { Entity } from 'koota'

	import { T, useTask, useThrelte } from '@threlte/core'
	import { BatchedMesh, Box3, Matrix4 } from 'three'
	import { OBB } from 'three/addons/math/OBB.js'

	import { composeBoxMatrix } from '$lib/components/Entities/composeBoxMatrix'
	import { composeCapsuleBoundsMatrix } from '$lib/components/Entities/composeCapsuleMatrices'
	import { composeCylinderBoundsMatrix } from '$lib/components/Entities/composeCylinderMatrix'
	import { composeSphereBoundsMatrix } from '$lib/components/Entities/composeSphereMatrix'
	import { traits, useQuery } from '$lib/ecs'
	import { BatchedAxesHelpers } from '$lib/three/BatchedAxesHelper'
	import { OBBHelper } from '$lib/three/OBBHelper'

	const box3 = new Box3()
	const obb = new OBB()
	const matrix4 = new Matrix4()

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

	const axesInstances = new Map<Entity, number>()

	const showAxes = (entity: Entity, world: Matrix4) => {
		const instance = axesInstances.get(entity)

		if (instance === undefined) {
			axesInstances.set(entity, selectedAxes.addHelper(world))
		} else {
			selectedAxes.setMatrixAt(instance, world)
		}
	}

	const hideAxes = (entity: Entity) => {
		const instance = axesInstances.get(entity)

		if (instance !== undefined) {
			selectedAxes.removeHelper(instance)
			axesInstances.delete(entity)
		}
	}

	/**
	 * Point `obbHelper` at the entity's bounds, returning `false` when the entity
	 * has none to measure.
	 */
	const setHelperBounds = (entity: Entity, obbHelper: OBBHelper): boolean => {
		/**
		 * Boxes, capsules, cylinders, and spheres render instanced, so the
		 * entity's named scene object carries no geometry — derive the OBB
		 * straight from traits.
		 */
		if (
			composeBoxMatrix(entity, matrix4) ||
			composeCapsuleBoundsMatrix(entity, matrix4) ||
			composeCylinderBoundsMatrix(entity, matrix4) ||
			composeSphereBoundsMatrix(entity, matrix4)
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

	$effect(() => {
		const stillSelected = new Set<Entity>(selected.current)

		for (const entity of axesInstances.keys()) {
			if (!stillSelected.has(entity)) {
				hideAxes(entity)
			}
		}
	})

	useTask(
		() => {
			for (const [entity, obbHelper] of obbHelpers) {
				const hasBounds = setHelperBounds(entity, obbHelper)
				obbHelper.visible = hasBounds

				const world = hasBounds ? undefined : entity.get(traits.WorldMatrix)

				if (world) {
					showAxes(entity, world)
				} else {
					hideAxes(entity)
				}
			}

			invalidate()
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

<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal, PortalTarget } from './portal'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { useGeometries } from '$lib/hooks/useGeometries.svelte'
	import { usePointClouds } from '$lib/hooks/usePointclouds.svelte'
	import { useDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import { useWorldStates } from '$lib/hooks/useWorldState.svelte'
	import { useArrows } from '$lib/hooks/useArrows.svelte'
	import Pose from './Pose.svelte'
	import Frame from './Frame.svelte'
	import Line from './Line.svelte'
	import Pointcloud from './Pointcloud.svelte'
	import Model from './WorldObject.svelte'
	import Label from './Label.svelte'
	import WorldState from './WorldState.svelte'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { Matrix4, Vector3 } from 'three'
	import { Quaternion } from 'three'
	import { createPose } from '$lib/transform'

	const points = usePointClouds()
	const drawAPI = useDrawAPI()
	const frames = useFrames()
	const geometries = useGeometries()
	const worldStates = useWorldStates()
	const batchedArrow = useArrows()

	const poseToMatrix = (pose: WorldObject['pose']) => {
		const matrix = new Matrix4()
		const poseQuaternion = new Quaternion().setFromAxisAngle(
			new Vector3(pose.oX, pose.oY, pose.oZ),
			pose.theta * (Math.PI / 180)
		)
		matrix.makeRotationFromQuaternion(poseQuaternion)
		matrix.setPosition(new Vector3(pose.x, pose.y, pose.z))
		return matrix
	}

	const matrixToPose = (matrix: Matrix4) => {
		const pose = createPose()
		const translation = new Vector3()
		const quaternion = new Quaternion()
		matrix.decompose(translation, quaternion, new Vector3())
		pose.x = translation.x
		pose.y = translation.y
		pose.z = translation.z

		const s = Math.sqrt(1 - quaternion.w * quaternion.w)
		if (s < 0.000001) {
			pose.oX = 0
			pose.oY = 0
			pose.oZ = 1
			pose.theta = 0
		} else {
			pose.oX = quaternion.x / s
			pose.oY = quaternion.y / s
			pose.oZ = quaternion.z / s
			pose.theta = Math.acos(quaternion.w) * 2 * (180 / Math.PI)
		}

		return pose
	}

	const determinePose = (
		object: WorldObject,
		pose: WorldObject['pose'] | undefined
	): WorldObject['pose'] => {
		if (pose === undefined) {
			return object.localEditedPose
		} else {
			const poseNetwork = poseToMatrix(object.pose)
			const poseUsePose = poseToMatrix(pose)
			const poseLocalEditedPose = poseToMatrix(object.localEditedPose)

			const poseNetworkInverse = poseNetwork.invert()
			const resultMatrix = poseUsePose.multiply(poseNetworkInverse).multiply(poseLocalEditedPose)
			return matrixToPose(resultMatrix)
		}
	}
</script>

{#each frames.current as object (object.uuid)}
	<Pose
		name={object.name}
		parent={object.referenceFrame}
	>
		{#snippet children({ pose })}
			{@const framePose = determinePose(object, pose)}
			<Portal id={object.referenceFrame}>
				<Frame
					uuid={object.uuid}
					name={object.name}
					pose={framePose}
					geometry={object.geometry}
					metadata={object.metadata}
				>
					<PortalTarget id={object.name} />
					<Label text={object.name} />
				</Frame>
			</Portal>
		{/snippet}
	</Pose>
{/each}

{#each geometries.current as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Frame
			uuid={object.uuid}
			name={object.name}
			pose={object.pose}
			geometry={object.geometry}
			metadata={object.metadata}
		>
			<PortalTarget id={object.name} />
			<Label text={object.name} />
		</Frame>
	</Portal>
{/each}

{#each worldStates.names as { name } (name)}
	<WorldState worldObjects={worldStates.current[name].worldObjects} />
{/each}

{#each points.current as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Pointcloud {object}>
			<Label text={object.name} />
		</Pointcloud>
	</Portal>
{/each}

{#each drawAPI.points as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Pointcloud {object}>
			<Label text={object.name} />
		</Pointcloud>
	</Portal>
{/each}

<T
	name={batchedArrow.object3d.name}
	is={batchedArrow.object3d}
	dispose={false}
	bvh={{ enabled: false }}
/>

{#each drawAPI.meshes as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Frame
			uuid={object.uuid}
			name={object.name}
			pose={object.pose}
			geometry={object.geometry}
			metadata={object.metadata}
		>
			<PortalTarget id={object.name} />
			<Label text={object.name} />
		</Frame>
	</Portal>
{/each}

{#each drawAPI.nurbs as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Frame
			uuid={object.uuid}
			name={object.name}
			pose={object.pose}
			geometry={object.geometry}
			metadata={object.metadata}
		>
			<PortalTarget id={object.name} />
			<Label text={object.name} />
		</Frame>
	</Portal>
{/each}

{#each drawAPI.models as object (object.uuid)}
	<Model {object}>
		<PortalTarget id={object.name} />
		<Label text={object.name} />
	</Model>
{/each}

{#each drawAPI.lines as object (object.uuid)}
	<Line {object}>
		<Label text={object.name} />
	</Line>
{/each}

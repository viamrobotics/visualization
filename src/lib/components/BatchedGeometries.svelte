<script lang="ts">
	import {
		BatchedMesh,
		BoxGeometry,
		Matrix4,
		MeshBasicMaterial,
		MeshToonMaterial,
		Object3D,
		SphereGeometry,
	} from 'three'
	import { T } from '@threlte/core'
	import { traits, useWorld } from '$lib/ecs'
	import { poseToMatrix, poseToObject3d } from '$lib/transform'
	import { CapsuleGeometry } from '$lib/lib'

	const object3d = new Object3D()
	const matrix = new Matrix4()
	const material = new MeshToonMaterial({ color: 'yellow', transparent: true, opacity: 0.5 })
	const batchedMesh = new BatchedMesh(1000, 20000, 20000, material)

	const wireframeMaterial = new MeshBasicMaterial({ wireframe: true })
	const batchedWireframe = new BatchedMesh(1000, 20000, 20000, wireframeMaterial)

	const boxGeometry = new BoxGeometry()
	const boxGeometryId = batchedMesh.addGeometry(boxGeometry)
	const sphereGeometry = new SphereGeometry()
	const sphereGeometryId = batchedMesh.addGeometry(sphereGeometry)

	const world = useWorld()

	world.onAdd(traits.Box, (entity) => {
		const box = entity.get(traits.Box)
		const pose = entity.get(traits.Pose)
		if (!pose || !box) return

		poseToMatrix(pose, matrix)
		matrix.scale(box)

		const instanceID = batchedMesh.addInstance(boxGeometryId)
		batchedMesh.setMatrixAt(instanceID, matrix)
	})

	world.onAdd(traits.Sphere, (entity) => {
		const sphere = entity.get(traits.Sphere)
		const pose = entity.get(traits.Pose)
		if (!pose || !sphere) return

		poseToObject3d(pose, object3d)
		object3d.scale.setScalar(sphere.r)

		const instanceID = batchedMesh.addInstance(sphereGeometryId)
		batchedMesh.setMatrixAt(instanceID, object3d.matrix)
	})

	world.onAdd(traits.Capsule, (entity) => {
		const capsule = entity.get(traits.Capsule)
		const pose = entity.get(traits.Pose)
		if (!pose || !capsule) return

		poseToObject3d(pose, object3d)

		const capsuleGeometry = new CapsuleGeometry(capsule.r, capsule.l)
		const capsuleGeometryId = batchedMesh.addGeometry(capsuleGeometry)
		const instanceID = batchedMesh.addInstance(capsuleGeometryId)
		batchedMesh.setMatrixAt(instanceID, object3d.matrix)
	})
</script>

<T
	is={batchedMesh}
	frustumCulled={false}
	dispose={false}
	bvh={{ enabled: false }}
/>

<T
	is={batchedWireframe}
	frustumCulled={false}
	dispose={false}
	bvh={{ enabled: false }}
/>

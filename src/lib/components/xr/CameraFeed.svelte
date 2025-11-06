<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { createStreamClient } from '@viamrobotics/svelte-sdk'
	import BentPlaneGeometry from '../BentPlaneGeometry.svelte'
	import { useHeadset } from '@threlte/xr'
	import { Euler, Group, Mesh, Vector3, Quaternion, VideoTexture } from 'three'
	import { usePartID } from '$lib/hooks/usePartID.svelte'

	interface CameraFeedProps {
		resourceName: string
	}

	let { resourceName }: CameraFeedProps = $props()

	const partID = usePartID()
	const streamClient = createStreamClient(
		() => partID.current,
		() => resourceName
	)

	let video = document.createElement('video')
	let aspect = $state(1)
	let ready = $state(false)

	video.addEventListener('canplaythrough', () => {
		aspect = video.videoWidth / video.videoHeight
		video.play()
	})

	$effect.pre(() => {
		video.srcObject = streamClient.mediaStream
		ready = true
	})

	const headset = useHeadset()

	let group = new Group()
	let mesh = new Mesh()
	let euler = new Euler()
	let quaternion = new Quaternion()
	let direction = new Vector3()

	const { start, stop } = useTask(
		(delta) => {
			group.position.lerp(headset.position, delta * 5)

			headset.getWorldDirection(direction)
			euler.set(0, Math.atan2(direction.x, direction.z), 0)
			quaternion.setFromEuler(euler)
			group.quaternion.slerp(quaternion, delta * 5)

			mesh.lookAt(headset.position)
		},
		{
			autoStart: false,
		}
	)

	$effect(() => {
		if (ready) {
			start()
		} else {
			stop()
		}
	})

	const texture = new VideoTexture(video)
</script>

{#if ready}
	<T is={group}>
		<T.Group>
			<T
				is={mesh}
				position={[0, 0, -1.5]}
				scale={0.7}
			>
				<BentPlaneGeometry args={[0.1, aspect, 1, 20, 20]} />
				<T.MeshBasicMaterial map={texture} />
			</T>
		</T.Group>
	</T>
{/if}

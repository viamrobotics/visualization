<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { createStreamClient } from '@viamrobotics/svelte-sdk'
	import BentPlaneGeometry from '../BentPlaneGeometry.svelte'
	import { useHeadset } from '@threlte/xr'
	import { Euler, Group, Mesh, Vector3, Quaternion, VideoTexture } from 'three'
	import { usePartID } from '$lib/hooks/usePartID.svelte'

	interface CameraFeedProps {
		resourceName: string
		offset?: { x?: number; y?: number; z?: number }
		scale?: number
	}

	let { resourceName, offset = {}, scale = 0.7 }: CameraFeedProps = $props()

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
		const mediaStream = streamClient.mediaStream
		if (!mediaStream) {
			ready = false
			return
		}

		video.srcObject = mediaStream
		ready = true

		// Cleanup when component unmounts
		return () => {
			ready = false
			video.pause()
			video.srcObject = null
			if (mediaStream) {
				mediaStream.getTracks().forEach(track => track.stop())
			}
		}
	})

	const texture = new VideoTexture(video)
</script>

{#if ready}
	<T.Mesh
		position={[offset.x ?? 0, offset.y ?? 0, offset.z ?? -1.5]}
		scale={scale}
	>
		<BentPlaneGeometry args={[0.1, aspect, 1, 20, 20]} />
		<T.MeshBasicMaterial map={texture} />
	</T.Mesh>
{/if}

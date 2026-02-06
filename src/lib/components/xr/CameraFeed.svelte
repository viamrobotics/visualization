<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { createStreamClient, useRobotClient } from '@viamrobotics/svelte-sdk'
	import { StreamClient } from '@viamrobotics/sdk'
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
	const robotClient = useRobotClient(() => partID.current)
	const streamClient = createStreamClient(
		() => partID.current,
		() => resourceName
	)

	// Create a StreamClient for setting options (separate from the video stream)
	let optionsClient = $derived(robotClient.current ? new StreamClient(robotClient.current) : undefined)

	// Request optimal resolution for low-latency VR streaming
	$effect(() => {
		if (optionsClient && resourceName) {
			// Use 640x480 for lower latency and smoother frame rate
			// Higher resolutions can cause lag in VR teleoperation
			setTimeout(() => {
				optionsClient.setOptions(resourceName, 640, 480).catch(() => {
					console.log(`[CameraFeed] Using default resolution for ${resourceName}`)
				})
			}, 100)
		}
	})

	let video = document.createElement('video')
	let aspect = $state(1)
	let ready = $state(false)
	let texture = $state<VideoTexture | null>(null)

	// Critical: video must autoplay and be muted for streams to work
	video.autoplay = true
	video.muted = true
	video.playsInline = true

	// Low-latency settings for teleoperation
	// @ts-ignore - latencyHint is not in standard types but supported by browsers
	video.latencyHint = 0  // Minimize latency
	// @ts-ignore
	video.disableRemotePlayback = true

	$effect.pre(() => {
		const mediaStream = streamClient.mediaStream
		if (!mediaStream) {
			ready = false
			texture?.dispose()
			texture = null
			return
		}

		video.srcObject = mediaStream

		// Wait for video to be ready before creating texture
		const onReady = () => {
			aspect = video.videoWidth / video.videoHeight

			if (!texture) {
				texture = new VideoTexture(video)
			}

			// Force play to ensure stream is active
			video.play().catch(e => console.warn('Video play failed:', e))
			ready = true
		}

		const onMetadata = () => {
			if (video.readyState >= video.HAVE_METADATA) {
				onReady()
			}
		}

		if (video.readyState >= video.HAVE_METADATA) {
			onReady()
		} else {
			video.addEventListener('loadedmetadata', onMetadata, { once: true })
		}

		// Cleanup when component unmounts
		return () => {
			ready = false
			video.pause()
			video.srcObject = null
			texture?.dispose()
			texture = null
			// Don't stop tracks - let the streamClient manage them
		}
	})

	// Update texture every frame to pull new video frames
	useTask(() => {
		if (texture && ready) {
			texture.needsUpdate = true
		}
	})
</script>

{#if ready && texture}
	<T.Mesh
		position={[offset.x ?? 0, offset.y ?? 0, offset.z ?? -1.5]}
		scale={scale}
	>
		<BentPlaneGeometry args={[0.1, aspect, 1, 20, 20]} />
		<T.MeshBasicMaterial map={texture} />
	</T.Mesh>
{/if}

<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { createStreamClient } from '@viamrobotics/svelte-sdk'
	import { VideoTexture } from 'three'

	import { usePartID } from '$lib/hooks/usePartID.svelte'

	import BentPlaneGeometry from './BentPlaneGeometry.svelte'

	interface CameraFeedProps {
		resourceName: string
		offset?: { x?: number; y?: number; z?: number }
		scale?: number
		enableProfiling?: boolean
		onAspectChange?: (aspect: number) => void
	}

	let {
		resourceName,
		offset = {},
		scale = 0.7,
		enableProfiling = false,
		onAspectChange,
	}: CameraFeedProps = $props()

	const partID = usePartID()
	const streamClient = createStreamClient(
		() => partID.current,
		() => resourceName
	)

	let video = document.createElement('video')
	let aspect = $state(1)
	let ready = $state(false)
	let texture = $state<VideoTexture | null>(null)

	interface LatencyMetrics {
		streamConnectTime?: number
		videoReadyTime?: number
		firstFrameTime?: number
		/** Camera capture to browser decode, from the frame metadata. */
		captureToPresent?: number
		/** Browser decode to Three.js texture update. */
		presentToRender?: number
		/** End-to-end capture to render. */
		totalLatency?: number
		fps?: number
	}
	let metrics = $state<LatencyMetrics>({})
	let frameCount = $state(0)
	let lastFrameTime = 0
	let fpsFrames: number[] = []
	let videoFrameCallbackId: number | null = null

	// Critical: video must autoplay and be muted for streams to work
	video.autoplay = true
	video.muted = true
	video.playsInline = true

	// @ts-expect-error - latencyHint is not in standard types but supported by browsers
	video.latencyHint = 0
	video.disableRemotePlayback = true

	$effect.pre(() => {
		const mediaStream = streamClient.mediaStream
		if (!mediaStream) {
			ready = false
			texture?.dispose()
			texture = null
			return
		}

		const streamConnectTime = performance.now()
		if (enableProfiling) {
			metrics.streamConnectTime = streamConnectTime
		}

		video.srcObject = mediaStream

		const onReady = () => {
			const videoReadyTime = performance.now()
			aspect = video.videoWidth / video.videoHeight
			onAspectChange?.(aspect)

			if (!texture) {
				texture = new VideoTexture(video)
			}

			video.play().catch((error) => console.warn('Video play failed:', error))
			ready = true

			if (enableProfiling) {
				metrics.videoReadyTime = videoReadyTime
				const setupLatency = videoReadyTime - streamConnectTime
				console.log(
					`[🎥 ${resourceName}] Ready: ${video.videoWidth}x${video.videoHeight} (setup: ${setupLatency.toFixed(0)}ms)`
				)
			}

			startFrameProfiling()
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

		return () => {
			ready = false
			video.pause()
			video.srcObject = null
			texture?.dispose()
			texture = null
			stopFrameProfiling()
			// Don't stop tracks - let the streamClient manage them
		}
	})

	function startFrameProfiling() {
		if (!enableProfiling) {
			return
		}

		stopFrameProfiling()

		const updateFrame = (now: number, metadata: VideoFrameCallbackMetadata) => {
			if (!texture || !ready) {
				stopFrameProfiling()
				return
			}

			frameCount++

			texture.needsUpdate = true

			if (metadata) {
				// All times in metadata are in microseconds, need to convert to ms
				// 'now' parameter is DOMHighResTimeStamp in milliseconds
				const captureTime = metadata.captureTime || metadata.mediaTime
				const presentationTime = metadata.presentationTime || metadata.expectedDisplayTime

				// The times might be in different epochs, so we can only reliably calculate
				// the difference between capture and presentation
				if (captureTime && presentationTime) {
					const captureToPresentMs = (presentationTime - captureTime) / 1000
					metrics.captureToPresent = captureToPresentMs

					// This should be very small (< 16ms ideally)
					const presentMsRelative = presentationTime / 1000
					const timeSincePresentation = now - presentMsRelative

					// Only use this if the time domains seem aligned (value is reasonable)
					if (Math.abs(timeSincePresentation) < 1000) {
						metrics.presentToRender = timeSincePresentation
						metrics.totalLatency = captureToPresentMs + timeSincePresentation
					} else {
						// Time domains don't align - just use capture to present as approximation
						metrics.presentToRender = undefined
						metrics.totalLatency = captureToPresentMs
					}
				}
			}

			if (lastFrameTime > 0) {
				const frameDelta = now - lastFrameTime
				fpsFrames.push(1000 / frameDelta)
				if (fpsFrames.length > 30) fpsFrames.shift()
				metrics.fps = fpsFrames.reduce((a, b) => a + b, 0) / fpsFrames.length
			}
			lastFrameTime = now

			if (enableProfiling && frameCount % 60 === 0) {
				const latency = metrics.totalLatency ? `${metrics.totalLatency.toFixed(1)}ms` : 'N/A'
				const fps = metrics.fps ? `${metrics.fps.toFixed(1)}fps` : 'N/A'
				const resolution = metadata ? `${metadata.width}x${metadata.height}` : 'N/A'
				console.log(`[🎥 ${resourceName}] ${resolution} @ ${fps} | Latency: ${latency}`)
			}

			videoFrameCallbackId = video.requestVideoFrameCallback(updateFrame)
		}

		videoFrameCallbackId = video.requestVideoFrameCallback(updateFrame)
	}

	function stopFrameProfiling() {
		if (videoFrameCallbackId !== null) {
			video.cancelVideoFrameCallback(videoFrameCallbackId)
			videoFrameCallbackId = null
		}
	}

	useTask(() => {
		if (!enableProfiling && texture && ready) {
			texture.needsUpdate = true
		}
	})
</script>

{#if ready && texture}
	<T.Mesh
		position={[offset.x ?? 0, offset.y ?? 0, offset.z ?? -1.5]}
		{scale}
	>
		<BentPlaneGeometry args={[0.1, aspect, 1, 20, 20]} />
		<T.MeshBasicMaterial map={texture} />
	</T.Mesh>
{/if}

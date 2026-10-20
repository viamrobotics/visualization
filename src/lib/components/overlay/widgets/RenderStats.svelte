<script lang="ts">
	import { useStage, useTask, useThrelte } from '@threlte/core'
	import { Folder, FpsGraph, Monitor, Pane, WaveformMonitor } from 'svelte-tweakpane-ui'

	import { useWorld } from '$lib/ecs'
	import { createGpuFrameTimer } from '$lib/three/gpuFrameTimer'

	/** Milliseconds between pane updates. Matches three-perf's 10 logs per second. */
	const PUBLISH_INTERVAL_MS = 100

	/** One frame at 60Hz. The CPU and GPU graphs peg when a frame busts the budget. */
	const FRAME_BUDGET_MS = 1000 / 60

	/** Animation frames the activity waveform holds, about 1.7 seconds at 60Hz. */
	const ACTIVITY_SAMPLES = 100

	/** Trailing window the long frame counters report over. */
	const LONG_FRAME_WINDOW_MS = 1000

	/** `memory` is non-standard and Chrome-only. Safari and Firefox omit it. */
	type PerformanceWithMemory = Performance & { memory?: { usedJSHeapSize: number } }

	/** Not in lib.dom: the script that ran inside a long animation frame. */
	interface ScriptTiming {
		duration: number
		invoker: string
		sourceFunctionName: string
		sourceURL: string
	}

	interface LongAnimationFrameTiming extends PerformanceEntry {
		scripts: ScriptTiming[]
	}

	const describeScript = (script: ScriptTiming): string => {
		const file = script.sourceURL.split('?')[0]?.split('/').at(-1) ?? ''
		const name = script.sourceFunctionName || script.invoker

		return file === '' ? name : `${name} @ ${file}`
	}

	const readHeapMb = (): number => {
		const { memory } = performance as PerformanceWithMemory
		return (memory?.usedJSHeapSize ?? 0) / 1024 ** 2
	}

	const formatMs = (value: number): string => `${value.toFixed(2)} ms`
	const formatMb = (value: number): string => `${value.toFixed(0)} MB`
	const formatCount = (value: number): string => Math.round(value).toLocaleString()

	const { autoRenderTask, mainStage, renderer, renderStage } = useThrelte()
	const world = useWorld()

	const gpuTimer = createGpuFrameTimer(renderer)
	const heapSupported = (performance as PerformanceWithMemory).memory !== undefined
	const longFramesSupported =
		PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')

	let frameStats = $state.raw({
		calls: 0,
		cpu: 0,
		gpu: 0,
		lines: 0,
		passes: 0,
		points: 0,
		triangles: 0,
	})

	let liveStats = $state.raw({
		entities: 0,
		frame: 0,
		geometries: 0,
		heapMb: 0,
		longestFrame: 0,
		longFrames: 0,
		programs: 0,
		source: 'none',
		textures: 0,
	})

	let longFrameLog: { duration: number; end: number; source: string }[] = []

	let activity = $state.raw(Array.from({ length: ACTIVITY_SAMPLES }, () => 0))

	let beginFpsSample = $state.raw<() => void>()
	let endFpsSample = $state.raw<() => void>()

	let frameStart = 0
	let passStart = 0
	let cpuTotal = 0
	let frames = 0
	let periodTotal = 0
	let periods = 0
	let rendered = false
	let lastFramePublish = 0
	let lastLivePublish = 0

	// three.js clears `renderer.info` as each render starts, and one frame can hold
	// several passes (a FramePov widget renders its own view). Accumulate across the
	// passes instead, and reset once the frame is done.
	$effect(() => {
		renderer.info.autoReset = false
		return () => {
			renderer.info.autoReset = true
		}
	})

	$effect(() => {
		return () => gpuTimer?.dispose()
	})

	// Main-thread stalls the render loop cannot see: Svelte updates, GC, and
	// message decoding all land here rather than in CPU. Long animation frames
	// carry the script that blocked, which `longtask` entries do not.
	$effect(() => {
		if (!longFramesSupported) {
			return
		}

		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries() as LongAnimationFrameTiming[]) {
				let worst: ScriptTiming | undefined

				for (const script of entry.scripts) {
					if (worst === undefined || script.duration > worst.duration) {
						worst = script
					}
				}

				longFrameLog.push({
					duration: entry.duration,
					end: entry.startTime + entry.duration,
					source: worst === undefined ? 'unattributed' : describeScript(worst),
				})
			}
		})

		observer.observe({ buffered: true, type: 'long-animation-frame' })

		return () => observer.disconnect()
	})

	const publishFrameStats = (now: number): void => {
		const { render } = renderer.info

		frameStats = {
			calls: render.calls,
			cpu: cpuTotal / frames,
			gpu: gpuTimer?.elapsedMs ?? 0,
			lines: render.lines,
			passes: render.frame - passStart,
			points: render.points,
			triangles: render.triangles,
		}

		cpuTotal = 0
		frames = 0
		lastFramePublish = now
	}

	const publishLiveStats = (now: number): void => {
		const { memory, programs } = renderer.info
		const cutoff = now - LONG_FRAME_WINDOW_MS

		longFrameLog = longFrameLog.filter((frame) => frame.end >= cutoff)

		let longest = { duration: 0, source: 'none' }

		for (const frame of longFrameLog) {
			if (frame.duration > longest.duration) {
				longest = frame
			}
		}

		liveStats = {
			entities: world.entities.length,
			frame: periods > 0 ? periodTotal / periods : 0,
			geometries: memory.geometries,
			heapMb: readHeapMb(),
			longestFrame: longest.duration,
			longFrames: longFrameLog.length,
			programs: programs?.length ?? 0,
			source: longest.source,
			textures: memory.textures,
		}

		periodTotal = 0
		periods = 0
		lastLivePublish = now
	}

	useTask(
		() => {
			const now = performance.now()

			// Start to start, so a frame the browser spent elsewhere still counts.
			if (frameStart > 0) {
				periodTotal += now - frameStart
				periods += 1
			}

			frameStart = now
			passStart = renderer.info.render.frame
			beginFpsSample?.()
		},
		{
			// Measuring must not itself keep the on-demand renderer awake.
			autoInvalidate: false,
			stage: useStage('render-stats-begin', { before: mainStage }),
		}
	)

	useTask(() => gpuTimer?.begin(), { autoInvalidate: false, before: autoRenderTask })

	// Ordered after the render task, so it only runs on frames that rendered. FPS
	// and the timings therefore describe rendered frames, not animation frames,
	// and they hold their last reading while the scene sits idle.
	useTask(
		() => {
			gpuTimer?.end()
			endFpsSample?.()
			rendered = true

			const now = performance.now()
			cpuTotal += now - frameStart
			frames += 1

			if (now - lastFramePublish >= PUBLISH_INTERVAL_MS) {
				publishFrameStats(now)
			}

			renderer.info.reset()
		},
		{ after: autoRenderTask, autoInvalidate: false }
	)

	// Runs on every animation frame, rendered or not, so the waveform shows the
	// frames that on-demand rendering skips. Reads the flag the render task sets
	// rather than `shouldRender()`, which can turn true again after the render
	// stage has already passed the frame over.
	useTask(
		() => {
			activity = [...activity.slice(1), rendered ? 1 : 0]
			rendered = false

			const now = performance.now()

			if (now - lastLivePublish >= PUBLISH_INTERVAL_MS) {
				publishLiveStats(now)
			}
		},
		{
			autoInvalidate: false,
			stage: useStage('render-stats-activity', { after: renderStage }),
		}
	)
</script>

<Pane
	position="draggable"
	title="Render stats"
	localStoreId="render-stats"
>
	<FpsGraph
		bind:begin={beginFpsSample}
		bind:end={endFpsSample}
		interval={PUBLISH_INTERVAL_MS}
		rows={2}
	/>

	<Folder title="Rendering activity">
		<WaveformMonitor
			value={activity}
			min={-1}
			max={2}
		/>
	</Folder>

	<Monitor
		value={liveStats.frame}
		label="Frame"
		format={formatMs}
	/>

	<Monitor
		value={frameStats.cpu}
		label="CPU"
		format={formatMs}
	/>
	<Monitor
		value={frameStats.cpu}
		graph
		min={0}
		max={FRAME_BUDGET_MS}
		rows={2}
	/>

	{#if gpuTimer !== undefined}
		<Monitor
			value={frameStats.gpu}
			label="GPU"
			format={formatMs}
		/>
		<Monitor
			value={frameStats.gpu}
			graph
			min={0}
			max={FRAME_BUDGET_MS}
			rows={2}
		/>
	{/if}

	{#if longFramesSupported}
		<Folder title="Main thread">
			<Monitor
				value={liveStats.longFrames}
				label="Long frames/s"
				format={formatCount}
			/>
			<Monitor
				value={liveStats.longestFrame}
				label="Longest"
				format={formatMs}
			/>
			<Monitor
				value={liveStats.source}
				label="Blamed"
			/>
		</Folder>
	{/if}

	<Folder title="Draw">
		<Monitor
			value={frameStats.calls}
			label="Draw calls"
			format={formatCount}
		/>
		<Monitor
			value={frameStats.passes}
			label="Render passes"
			format={formatCount}
		/>
		<Monitor
			value={frameStats.triangles}
			label="Triangles"
			format={formatCount}
		/>
		<Monitor
			value={frameStats.lines}
			label="Lines"
			format={formatCount}
		/>
		<Monitor
			value={frameStats.points}
			label="Points"
			format={formatCount}
		/>
	</Folder>

	<Folder title="Resources">
		<Monitor
			value={liveStats.entities}
			label="Entities"
			format={formatCount}
		/>
		<Monitor
			value={liveStats.geometries}
			label="Geometries"
			format={formatCount}
		/>
		<Monitor
			value={liveStats.textures}
			label="Textures"
			format={formatCount}
		/>
		<Monitor
			value={liveStats.programs}
			label="Programs"
			format={formatCount}
		/>

		{#if heapSupported}
			<Monitor
				value={liveStats.heapMb}
				label="JS heap"
				format={formatMb}
			/>
		{/if}
	</Folder>
</Pane>

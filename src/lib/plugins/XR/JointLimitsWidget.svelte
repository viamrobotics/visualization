<script lang="ts">
	import { T } from '@threlte/core'
	import { CanvasTexture, PlaneGeometry } from 'three'

	import { useArmClient } from '$lib/hooks/useArmClient.svelte'
	import { useArmKinematics } from '$lib/hooks/useArmKinematics.svelte'

	interface JointLimitsWidgetProps {
		armName: string
		offset?: { x?: number; y?: number; z?: number }
		scale?: number
		rotationY?: number
	}

	let { armName, offset = {}, scale = 0.6, rotationY = 0 }: JointLimitsWidgetProps = $props()

	const armClient = useArmClient()
	const armKinematics = useArmKinematics()

	interface JointLimitData {
		jointId: string
		currentPosition: number
		min: number
		max: number
		percentage: number
		status: 'safe' | 'caution' | 'danger'
	}

	const jointLimits = $derived(armKinematics.kinematics[armName])
	const currentPositions = $derived(armClient.currentPositions[armName])

	const jointData = $derived.by((): JointLimitData[] | undefined => {
		if (!jointLimits || !currentPositions) return undefined

		return jointLimits.map((limit, index) => {
			const current = currentPositions[index] ?? 0
			const range = limit.max - limit.min
			const percentage = range === 0 ? 50 : ((current - limit.min) / range) * 100

			let status: 'safe' | 'caution' | 'danger'
			if (percentage < 10 || percentage > 90) {
				status = 'danger'
			} else if (percentage < 20 || percentage > 80) {
				status = 'caution'
			} else {
				status = 'safe'
			}

			return {
				jointId: limit.id,
				currentPosition: current,
				min: limit.min,
				max: limit.max,
				percentage,
				status,
			}
		})
	})

	// Canvas setup — use 2x resolution for sharper XR text
	const RESOLUTION_SCALE = 4
	const CANVAS_WIDTH = 800 * RESOLUTION_SCALE
	const HEADER_HEIGHT = 80 * RESOLUTION_SCALE
	const ROW_HEIGHT = 120 * RESOLUTION_SCALE
	let canvasHeight = $derived(HEADER_HEIGHT + (jointData?.length ?? 0) * ROW_HEIGHT)

	let canvas: HTMLCanvasElement | undefined = $state()
	let texture: CanvasTexture | undefined = $state()
	let geometry: PlaneGeometry | undefined = $state()

	$effect(() => {
		if (!canvas && jointData && jointData.length > 0) {
			canvas = document.createElement('canvas')
			canvas.width = CANVAS_WIDTH
			canvas.height = canvasHeight
			texture = new CanvasTexture(canvas)

			const aspect = CANVAS_WIDTH / canvasHeight
			geometry = new PlaneGeometry(1.2, 1.2 / aspect)
		}
	})

	$effect(() => {
		if (canvas && jointData) {
			const newHeight = HEADER_HEIGHT + jointData.length * ROW_HEIGHT
			if (canvas.height !== newHeight) {
				canvas.height = newHeight

				const aspect = CANVAS_WIDTH / newHeight
				geometry?.dispose()
				geometry = new PlaneGeometry(1.2, 1.2 / aspect)
			}
		}
	})

	function renderHeader(ctx: CanvasRenderingContext2D, width: number) {
		const s = RESOLUTION_SCALE

		ctx.fillStyle = '#0a0a0a'
		ctx.fillRect(0, 0, width, HEADER_HEIGHT)

		ctx.fillStyle = '#ffffff'
		ctx.font = `bold ${36 * s}px monospace`
		ctx.textBaseline = 'middle'
		ctx.fillText(armName, 20 * s, HEADER_HEIGHT / 2)

		ctx.strokeStyle = '#444444'
		ctx.lineWidth = 4 * s
		ctx.beginPath()
		ctx.moveTo(0, HEADER_HEIGHT)
		ctx.lineTo(width, HEADER_HEIGHT)
		ctx.stroke()
	}

	const getJointColor = (status: 'safe' | 'caution' | 'danger') => {
		if (status === 'danger') {
			return '#ff4444'
		}

		if (status === 'caution') {
			return '#ffaa00'
		}

		return '#44ff44'
	}

	function renderJointLimits(
		ctx: CanvasRenderingContext2D,
		joints: JointLimitData[],
		width: number,
		height: number
	) {
		const s = RESOLUTION_SCALE
		const rowHeight = (height - HEADER_HEIGHT) / joints.length

		let index = 0
		for (const joint of joints) {
			const y = HEADER_HEIGHT + index * rowHeight

			ctx.fillStyle = index % 2 === 0 ? '#1a1a1a' : '#222222'
			ctx.fillRect(0, y, width, rowHeight)

			ctx.fillStyle = '#ffffff'
			ctx.font = `bold ${32 * s}px monospace`
			ctx.textBaseline = 'middle'
			ctx.fillText(joint.jointId, 20 * s, y + rowHeight / 2)

			const barX = 240 * s
			const barY = y + (rowHeight - 60 * s) / 2
			const barWidth = 360 * s
			const barHeight = 60 * s

			ctx.fillStyle = '#333333'
			ctx.fillRect(barX, barY, barWidth, barHeight)

			const fillWidth = barWidth * (joint.percentage / 100)
			ctx.fillStyle = getJointColor(joint.status)
			ctx.fillRect(barX, barY, fillWidth, barHeight)

			ctx.strokeStyle = '#666666'
			ctx.lineWidth = 4 * s
			ctx.strokeRect(barX, barY, barWidth, barHeight)

			ctx.fillStyle = '#ffffff'
			ctx.font = `${28 * s}px monospace`
			ctx.fillText(
				`${joint.currentPosition.toFixed(1)}°`,
				barX + barWidth + 20 * s,
				y + rowHeight / 2
			)

			index += 1
		}
	}

	$effect(() => {
		if (canvas && jointData && jointData.length > 0) {
			const ctx = canvas.getContext('2d')
			if (!ctx) return

			ctx.clearRect(0, 0, canvas.width, canvas.height)

			renderHeader(ctx, canvas.width)

			renderJointLimits(ctx, jointData, canvas.width, canvas.height)

			if (texture) {
				texture.needsUpdate = true
			}
		}
	})
</script>

{#if texture && geometry && jointData && jointData.length > 0}
	<T.Mesh
		position={[offset.x ?? 0, offset.y ?? 1.5, offset.z ?? -2.5]}
		rotation.y={rotationY}
		{scale}
	>
		<T is={geometry} />
		<T.MeshBasicMaterial map={texture} />
	</T.Mesh>
{/if}

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

	let {
		armName,
		offset = {},
		scale = 0.6,
		rotationY = -15 * (Math.PI / 180),
	}: JointLimitsWidgetProps = $props()

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

	// Get joint limits and current positions for this arm
	const jointLimits = $derived(armKinematics.kinematics[armName])
	const currentPositions = $derived(armClient.currentPositions[armName])

	// Combine limits and positions into display data
	const jointData = $derived.by((): JointLimitData[] | undefined => {
		if (!jointLimits || !currentPositions) return undefined

		return jointLimits.map((limit, index) => {
			const current = currentPositions[index] ?? 0
			const range = limit.max - limit.min
			const percentage = range !== 0 ? ((current - limit.min) / range) * 100 : 50

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

	// Canvas setup
	const CANVAS_WIDTH = 800
	const HEADER_HEIGHT = 80
	const ROW_HEIGHT = 120
	let canvasHeight = $derived(HEADER_HEIGHT + (jointData?.length ?? 0) * ROW_HEIGHT)

	let canvas: HTMLCanvasElement | undefined = $state()
	let texture: CanvasTexture | undefined = $state()
	let geometry: PlaneGeometry | undefined = $state()

	// Initialize canvas
	$effect(() => {
		if (!canvas && jointData && jointData.length > 0) {
			canvas = document.createElement('canvas')
			canvas.width = CANVAS_WIDTH
			canvas.height = canvasHeight
			texture = new CanvasTexture(canvas)

			// Calculate aspect ratio for plane geometry
			const aspect = CANVAS_WIDTH / canvasHeight
			// Width in 3D space, height based on aspect
			geometry = new PlaneGeometry(1.2, 1.2 / aspect)
		}
	})

	// Update canvas height when number of joints changes
	$effect(() => {
		if (canvas && jointData) {
			const newHeight = HEADER_HEIGHT + jointData.length * ROW_HEIGHT
			if (canvas.height !== newHeight) {
				canvas.height = newHeight

				// Update geometry for new aspect ratio
				const aspect = CANVAS_WIDTH / newHeight
				geometry?.dispose()
				geometry = new PlaneGeometry(1.2, 1.2 / aspect)
			}
		}
	})

	// Render header with arm name
	function renderHeader(ctx: CanvasRenderingContext2D, width: number) {
		// Header background
		ctx.fillStyle = '#0a0a0a'
		ctx.fillRect(0, 0, width, HEADER_HEIGHT)

		// Arm name
		ctx.fillStyle = '#ffffff'
		ctx.font = 'bold 36px monospace'
		ctx.textBaseline = 'middle'
		ctx.fillText(armName, 20, HEADER_HEIGHT / 2)

		// Separator line
		ctx.strokeStyle = '#444444'
		ctx.lineWidth = 4
		ctx.beginPath()
		ctx.moveTo(0, HEADER_HEIGHT)
		ctx.lineTo(width, HEADER_HEIGHT)
		ctx.stroke()
	}

	// Render joint data to canvas
	function renderJointLimits(
		ctx: CanvasRenderingContext2D,
		joints: JointLimitData[],
		width: number,
		height: number
	) {
		const rowHeight = (height - HEADER_HEIGHT) / joints.length

		joints.forEach((joint, index) => {
			const y = HEADER_HEIGHT + index * rowHeight

			// Background row
			ctx.fillStyle = index % 2 === 0 ? '#1a1a1a' : '#222222'
			ctx.fillRect(0, y, width, rowHeight)

			// Joint label
			ctx.fillStyle = '#ffffff'
			ctx.font = 'bold 32px monospace'
			ctx.textBaseline = 'middle'
			ctx.fillText(joint.jointId, 20, y + rowHeight / 2)

			// Progress bar dimensions
			const barX = 240
			const barY = y + (rowHeight - 60) / 2
			const barWidth = 360
			const barHeight = 60

			// Progress bar background
			ctx.fillStyle = '#333333'
			ctx.fillRect(barX, barY, barWidth, barHeight)

			// Progress bar fill (colored by status)
			const fillWidth = barWidth * (joint.percentage / 100)
			ctx.fillStyle =
				joint.status === 'danger' ? '#ff4444' : joint.status === 'caution' ? '#ffaa00' : '#44ff44'
			ctx.fillRect(barX, barY, fillWidth, barHeight)

			// Progress bar border
			ctx.strokeStyle = '#666666'
			ctx.lineWidth = 4
			ctx.strokeRect(barX, barY, barWidth, barHeight)

			// Current value text
			ctx.fillStyle = '#ffffff'
			ctx.font = '28px monospace'
			ctx.fillText(`${joint.currentPosition.toFixed(1)}°`, barX + barWidth + 20, y + rowHeight / 2)
		})
	}

	// Update canvas when joint data changes
	$effect(() => {
		if (canvas && jointData && jointData.length > 0) {
			const ctx = canvas.getContext('2d')
			if (!ctx) return

			// Clear canvas
			ctx.clearRect(0, 0, canvas.width, canvas.height)

			// Render header with arm name
			renderHeader(ctx, canvas.width)

			// Render joint limits
			renderJointLimits(ctx, jointData, canvas.width, canvas.height)

			// Mark texture for update
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

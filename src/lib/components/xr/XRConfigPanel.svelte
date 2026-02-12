<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { CanvasTexture, PlaneGeometry, Mesh, Raycaster } from 'three'
	import { useArmClient } from '$lib/hooks/useArmClient.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useResourceNames } from '@viamrobotics/svelte-sdk'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useController, type XRController } from '@threlte/xr'

	interface VRConfigPanelProps {
		offset?: { x?: number; y?: number; z?: number }
		scale?: number
	}

	let { offset = {}, scale = 0.8 }: VRConfigPanelProps = $props()

	const settings = useSettings()
	const armClient = useArmClient()
	const partID = usePartID()

	let resources: ReturnType<typeof useResourceNames> | undefined
	try {
		resources = useResourceNames(() => partID.current)
	} catch (e) {
		console.warn('Failed to get resources, robot may not be connected yet:', e)
	}

	// Get available arms and grippers
	const armNames = $derived(armClient.names || [])
	const gripperNames = $derived(
		resources?.current
			?.filter((r) => r.subtype === 'gripper' && r.type === 'component')
			.map((r) => r.name) || []
	)

	// Local state for UI
	type Hand = 'left' | 'right'
	let selectedHand = $state<Hand>('right')

	// Get current config for selected hand
	const currentConfig = $derived(settings.current.xrControllerConfig[selectedHand])

	// Local form state (editable) — synced from currentConfig via effect
	let formArmName = $state<string | undefined>(undefined)
	let formGripperName = $state<string | undefined>(undefined)
	let formScaleFactor = $state<number>(1.0)
	let formRotationEnabled = $state<boolean>(true)

	// Sync form state when selected hand or config changes
	$effect(() => {
		const cfg = currentConfig
		formArmName = cfg.armName
		formGripperName = cfg.gripperName
		formScaleFactor = cfg.scaleFactor
		formRotationEnabled = cfg.rotationEnabled
	})

	// Canvas setup
	const CANVAS_WIDTH = 600
	const CANVAS_HEIGHT = 500

	let canvas: HTMLCanvasElement | undefined = $state()
	let texture: CanvasTexture | undefined = $state()
	let geometry: PlaneGeometry | undefined = $state()

	// Initialize canvas
	$effect(() => {
		if (!canvas) {
			canvas = document.createElement('canvas')
			canvas.width = CANVAS_WIDTH
			canvas.height = CANVAS_HEIGHT
			texture = new CanvasTexture(canvas)

			// Calculate aspect ratio for plane geometry
			const aspect = CANVAS_WIDTH / CANVAS_HEIGHT
			geometry = new PlaneGeometry(1.5, 1.5 / aspect)
		}
	})

	// UI element bounds for interaction
	interface UIElement {
		x: number
		y: number
		width: number
		height: number
		type: 'button' | 'dropdown' | 'slider' | 'checkbox' | 'tab'
		id: string
	}

	let uiElements: UIElement[] = []

	// Mesh ref for raycasting
	let meshRef = $state<Mesh | undefined>()

	// Controller interaction
	const rightController = useController('right')
	const leftController = useController('left')

	// Interaction state
	let hoveredElement = $state<UIElement | undefined>()
	let lastButtonPressed = $state(false)

	// Handle click on UI element
	function handleClick(element: UIElement) {
		if (element.type === 'tab') {
			selectedHand = element.id as Hand
		} else if (element.type === 'button' && element.id === 'apply') {
			applySettings()
		} else if (element.id === 'arm-dropdown') {
			// Cycle through arms
			const currentIndex = armNames.indexOf(formArmName || '')
			const nextIndex = (currentIndex + 1) % (armNames.length + 1)
			formArmName = nextIndex === armNames.length ? undefined : armNames[nextIndex]
		} else if (element.id === 'gripper-dropdown') {
			// Cycle through grippers
			const currentIndex = gripperNames.indexOf(formGripperName || '')
			const nextIndex = (currentIndex + 1) % (gripperNames.length + 1)
			formGripperName = nextIndex === gripperNames.length ? undefined : gripperNames[nextIndex]
		} else if (element.id === 'rotation-checkbox') {
			formRotationEnabled = !formRotationEnabled
		}
	}

	// Reusable raycaster to avoid per-frame allocation
	const raycaster = new Raycaster()

	// Check for ray intersection with panel
	function checkIntersection(controllerRef: typeof rightController) {
		if (!meshRef || !controllerRef.current) return

		const controller = controllerRef.current

		// Get controller's world position and direction
		const tempMatrix = controller.targetRay.matrixWorld
		if (!tempMatrix || !tempMatrix.elements) return

		raycaster.ray.origin.setFromMatrixPosition(tempMatrix)
		raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix).normalize()

		// Check intersection with mesh
		const intersects = raycaster.intersectObject(meshRef, false)

		if (intersects.length > 0) {
			const intersect = intersects[0]
			const uv = intersect.uv

			if (uv) {
				// Map UV to canvas coordinates
				const canvasX = uv.x * CANVAS_WIDTH
				const canvasY = (1 - uv.y) * CANVAS_HEIGHT

				// Check which UI element was hit
				const hitElement = uiElements.find(
					(el) =>
						canvasX >= el.x &&
						canvasX <= el.x + el.width &&
						canvasY >= el.y &&
						canvasY <= el.y + el.height
				)

				hoveredElement = hitElement
				return hitElement
			}
		}

		hoveredElement = undefined
		return undefined
	}

	// Monitor controller A/X button every frame
	useTask(() => {
		const controller = rightController.current || leftController.current
		if (!controller) return

		// Check for intersection
		const hitElement = checkIntersection(rightController.current ? rightController : leftController)

		// Check for A/X button press (rising edge) - gamepad button 4
		const gamepad = (controller as XRController & { gamepad?: Gamepad }).gamepad
		const buttonPressed = gamepad?.buttons?.[4]?.pressed || false

		if (buttonPressed && !lastButtonPressed && hitElement) {
			handleClick(hitElement)
		}

		lastButtonPressed = buttonPressed
	})

	// Apply settings
	function applySettings() {
		settings.current.xrControllerConfig[selectedHand] = {
			armName: formArmName,
			gripperName: formGripperName,
			scaleFactor: formScaleFactor,
			rotationEnabled: formRotationEnabled,
		}
	}

	// Render functions
	function renderHeader(ctx: CanvasRenderingContext2D, width: number) {
		// Header background
		ctx.fillStyle = '#0a0a0a'
		ctx.fillRect(0, 0, width, 50)

		// Title
		ctx.fillStyle = '#ffffff'
		ctx.font = 'bold 20px sans-serif'
		ctx.textBaseline = 'middle'
		ctx.fillText('VR Controller Configuration', 20, 20)

		// Instruction text
		ctx.font = '12px sans-serif'
		ctx.fillStyle = '#999999'
		ctx.fillText('Use A/X button to click', 20, 38)

		// Separator line
		ctx.strokeStyle = '#444444'
		ctx.lineWidth = 2
		ctx.beginPath()
		ctx.moveTo(0, 50)
		ctx.lineTo(width, 50)
		ctx.stroke()
	}

	function renderTabs(ctx: CanvasRenderingContext2D, width: number) {
		const tabY = 50
		const tabHeight = 40
		const tabWidth = width / 2

		// Clear UI elements for tabs
		uiElements = uiElements.filter((el) => el.type !== 'tab')

		// Left tab
		ctx.fillStyle = selectedHand === 'left' ? '#333333' : '#1a1a1a'
		ctx.fillRect(0, tabY, tabWidth, tabHeight)
		ctx.fillStyle = '#ffffff'
		ctx.font = 'bold 18px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText('LEFT', tabWidth / 2, tabY + tabHeight / 2)

		uiElements.push({
			x: 0,
			y: tabY,
			width: tabWidth,
			height: tabHeight,
			type: 'tab',
			id: 'left',
		})

		// Right tab
		ctx.fillStyle = selectedHand === 'right' ? '#333333' : '#1a1a1a'
		ctx.fillRect(tabWidth, tabY, tabWidth, tabHeight)
		ctx.fillStyle = '#ffffff'
		ctx.fillText('RIGHT', tabWidth + tabWidth / 2, tabY + tabHeight / 2)

		uiElements.push({
			x: tabWidth,
			y: tabY,
			width: tabWidth,
			height: tabHeight,
			type: 'tab',
			id: 'right',
		})

		// Tab separator line
		ctx.strokeStyle = '#444444'
		ctx.lineWidth = 2
		ctx.beginPath()
		ctx.moveTo(0, tabY + tabHeight)
		ctx.lineTo(width, tabY + tabHeight)
		ctx.stroke()

		ctx.textAlign = 'left'
	}

	function renderFormControls(ctx: CanvasRenderingContext2D, width: number) {
		const formY = 90
		const rowHeight = 70
		const labelX = 30
		const controlX = 200
		const controlWidth = 350

		// Clear form control UI elements
		uiElements = uiElements.filter((el) => el.type === 'tab')

		// Arm dropdown
		ctx.fillStyle = '#ffffff'
		ctx.font = '16px sans-serif'
		ctx.textBaseline = 'middle'
		ctx.fillText('Arm:', labelX, formY + rowHeight * 0 + 25)

		const armDropdownY = formY + rowHeight * 0 + 10
		ctx.fillStyle = hoveredElement?.id === 'arm-dropdown' ? '#444444' : '#333333'
		ctx.fillRect(controlX, armDropdownY, controlWidth, 40)
		ctx.fillStyle = '#ffffff'
		ctx.fillText(formArmName || 'None (click to cycle)', controlX + 10, formY + rowHeight * 0 + 30)

		uiElements.push({
			x: controlX,
			y: armDropdownY,
			width: controlWidth,
			height: 40,
			type: 'dropdown',
			id: 'arm-dropdown',
		})

		// Gripper dropdown
		ctx.fillText('Gripper:', labelX, formY + rowHeight * 1 + 25)

		const gripperDropdownY = formY + rowHeight * 1 + 10
		ctx.fillStyle = hoveredElement?.id === 'gripper-dropdown' ? '#444444' : '#333333'
		ctx.fillRect(controlX, gripperDropdownY, controlWidth, 40)
		ctx.fillStyle = '#ffffff'
		ctx.fillText(
			formGripperName || 'None (click to cycle)',
			controlX + 10,
			formY + rowHeight * 1 + 30
		)

		uiElements.push({
			x: controlX,
			y: gripperDropdownY,
			width: controlWidth,
			height: 40,
			type: 'dropdown',
			id: 'gripper-dropdown',
		})

		// Scale factor slider
		ctx.fillText('Scale Factor:', labelX, formY + rowHeight * 2 + 25)

		// Slider track
		const sliderX = controlX
		const sliderY = formY + rowHeight * 2 + 20
		const sliderWidth = 250
		const sliderHeight = 10

		ctx.fillStyle = '#333333'
		ctx.fillRect(sliderX, sliderY, sliderWidth, sliderHeight)

		// Slider thumb
		const thumbPos = ((formScaleFactor - 0.1) / (3.0 - 0.1)) * sliderWidth
		ctx.fillStyle = '#4CAF50'
		ctx.beginPath()
		ctx.arc(sliderX + thumbPos, sliderY + sliderHeight / 2, 12, 0, Math.PI * 2)
		ctx.fill()

		// Scale value text
		ctx.fillStyle = '#ffffff'
		ctx.font = '14px sans-serif'
		ctx.fillText(formScaleFactor.toFixed(1), sliderX + sliderWidth + 15, sliderY + sliderHeight / 2)

		// Rotation checkbox
		ctx.font = '16px sans-serif'
		ctx.fillText('Enable Rotation', labelX, formY + rowHeight * 3 + 25)

		// Checkbox
		const checkboxX = controlX
		const checkboxY = formY + rowHeight * 3 + 10
		const checkboxSize = 30

		ctx.strokeStyle = hoveredElement?.id === 'rotation-checkbox' ? '#888888' : '#666666'
		ctx.lineWidth = 2
		ctx.strokeRect(checkboxX, checkboxY, checkboxSize, checkboxSize)

		if (formRotationEnabled) {
			ctx.fillStyle = '#4CAF50'
			ctx.fillRect(checkboxX + 5, checkboxY + 5, checkboxSize - 10, checkboxSize - 10)
		}

		uiElements.push({
			x: checkboxX,
			y: checkboxY,
			width: checkboxSize,
			height: checkboxSize,
			type: 'checkbox',
			id: 'rotation-checkbox',
		})

		// Apply button
		const buttonY = formY + rowHeight * 4 + 10
		const buttonX = width / 2 - 100
		const buttonWidth = 200
		const buttonHeight = 50

		ctx.fillStyle = hoveredElement?.id === 'apply' ? '#5CBF60' : '#4CAF50'
		ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight)
		ctx.fillStyle = '#ffffff'
		ctx.font = 'bold 18px sans-serif'
		ctx.textAlign = 'center'
		ctx.fillText('Apply Settings', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2)

		uiElements.push({
			x: buttonX,
			y: buttonY,
			width: buttonWidth,
			height: buttonHeight,
			type: 'button',
			id: 'apply',
		})

		ctx.textAlign = 'left'
	}

	// Render canvas
	$effect(() => {
		if (canvas) {
			const ctx = canvas.getContext('2d')
			if (!ctx) return

			// Clear canvas
			ctx.clearRect(0, 0, canvas.width, canvas.height)

			// Background
			ctx.fillStyle = '#1a1a1a'
			ctx.fillRect(0, 0, canvas.width, canvas.height)

			// Render components
			renderHeader(ctx, canvas.width)
			renderTabs(ctx, canvas.width)
			renderFormControls(ctx, canvas.width)

			// Mark texture for update
			if (texture) {
				texture.needsUpdate = true
			}
		}
	})

	// Clean up on unmount
	$effect(() => {
		return () => {
			texture?.dispose()
			geometry?.dispose()
		}
	})
</script>

{#if texture && geometry}
	<T.Mesh
		bind:ref={meshRef}
		position={[offset.x ?? 0, offset.y ?? 2.5, offset.z ?? -2.5]}
		{scale}
	>
		<T is={geometry} />
		<T.MeshBasicMaterial map={texture} />
	</T.Mesh>
{/if}

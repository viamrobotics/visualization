import { getContext, setContext } from 'svelte'
import { Color, Vector3, Vector4 } from 'three'
import { NURBSCurve } from 'three/addons/curves/NURBSCurve.js'
import { UuidTool } from 'uuid-tool'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Frame } from '$lib/frame'
import { createPose, createPoseFromFrame } from '$lib/transform'
import { useCameraControls } from './useControls.svelte'
import { useWorld, traits } from '$lib/ecs'
import { useThrelte } from '@threlte/core'
import { type ConfigurableTrait, type Entity } from 'koota'
import { parsePlyInput } from '$lib/ply'
import { useLogs } from './useLogs.svelte'
import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { useDrawConnectionConfig } from './useDrawConnectionConfig.svelte'
import { createBufferGeometry, updateBufferGeometry } from '$lib/attribute'
import { STRIDE } from '$lib/buffer'

const colorUtil = new Color()

type ConnectionStatus = 'connecting' | 'open' | 'closed'

interface Context {
	connectionStatus: ConnectionStatus
}

const bufferTypes = {
	DRAW_POINTS: 0,
	DRAW_POSES: 1,
	DRAW_LINE: 2,
	DRAW_PCD: 3,
	DRAW_GLTF: 4,
} as const

const key = Symbol('draw-api-context-key')

const tryParse = (json: string) => {
	try {
		return [null, JSON.parse(json)]
	} catch (error) {
		return [error, null]
	}
}

/**
 * @TODO get golang scripts to return protobufs so that we
 * can use our types. Right now we're just marshalling JSON,
 * leading to upper case var names and no type contract with the golang lib.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lowercaseKeys = <T>(obj: T): any => {
	if (Array.isArray(obj)) {
		return obj.map(lowercaseKeys)
	} else if (obj && typeof obj === 'object' && obj.constructor === Object) {
		return Object.fromEntries(
			Object.entries(obj).map(([k, v]) => [k.toLowerCase(), lowercaseKeys(v)])
		)
	}
	return obj
}

class BinaryReader {
	littleEndian = true
	offsetBytes = 0

	buffer = new ArrayBuffer(0)
	view = new DataView(this.buffer)

	header = { requestID: '', type: -1 }

	async init(data: Blob) {
		this.buffer = await data.arrayBuffer()
		this.view = new DataView(this.buffer)
		this.offsetBytes = 0

		// 16-byte UUID
		const uuidBytes = new Uint8Array(this.buffer, 0, 16)
		this.header.requestID = UuidTool.toString([...uuidBytes])

		// 4-byte float32 type at byte offset 16
		this.header.type = this.view.getFloat32(16, this.littleEndian)

		// payload starts after 20 bytes
		this.offsetBytes = 20
		return this
	}

	/** Read one float32 and advance. */
	read() {
		const v = this.view.getFloat32(this.offsetBytes, this.littleEndian)
		this.offsetBytes += 4
		return v
	}

	/**
	 * Get a Float32Array VIEW into the underlying buffer (no copy) and advance.
	 * Requires current offset to be 4-byte aligned (it will be, if you only readF32 so far).
	 */
	readF32Array(count: number) {
		const byteOffset = this.offsetBytes
		const byteLength = count * 4
		const arr = new Float32Array(this.buffer, byteOffset, count)
		this.offsetBytes += byteLength
		return arr
	}

	/**
	 * Get a Uint8Array VIEW (no copy) and advance.
	 */
	readU8Array(count: number) {
		const byteOffset = this.offsetBytes
		const arr = new Uint8Array(this.buffer, byteOffset, count)
		this.offsetBytes += count
		return arr
	}
}

export const provideDrawAPI = () => {
	const world = useWorld()
	const logs = useLogs()
	const cameraControls = useCameraControls()
	const { invalidate } = useThrelte()
	const drawConnectionConfig = useDrawConnectionConfig()

	const backendIP = $derived(drawConnectionConfig.current?.backendIP)
	const websocketPort = $derived(drawConnectionConfig.current?.websocketPort)

	let geometryIndex = 0
	let poseIndex = 0

	let reconnectDelay = 200

	const maxReconnectDelay = 5_000

	let ws: WebSocket | undefined

	let connectionStatus = $state<ConnectionStatus>('connecting')

	const loader = new GLTFLoader()
	const entities = new Map<string, Entity>()

	const sendResponse = (response: { requestID: string; code: number; message: string }) => {
		ws?.send(JSON.stringify(response))
	}

	const drawFrames = async (data: Frame[]) => {
		for (const rawFrame of data) {
			const frame = lowercaseKeys(rawFrame) as Frame
			const pose = createPoseFromFrame(frame)
			const name = frame.name ?? frame.id ?? ''
			const parent = frame.parent

			const existing = entities.get(name)

			if (existing) {
				existing.set(traits.Pose, pose)

				if (parent && parent !== 'world') {
					existing.set(traits.Parent, parent)
				}

				continue
			}

			const geometryTrait = () => {
				if (frame.geometry?.type === 'box') {
					return traits.Box(frame.geometry)
				} else if (frame.geometry?.type === 'sphere') {
					return traits.Sphere(frame.geometry)
				} else if (frame.geometry?.type === 'capsule') {
					return traits.Capsule(frame.geometry)
				}

				return traits.ReferenceFrame
			}

			const entityTraits: ConfigurableTrait[] = []

			if (parent && parent !== 'world') {
				entityTraits.push(traits.Parent(parent))
			}

			if (frame.geometry) {
				entityTraits.push(geometryTrait())
			}

			entityTraits.push(traits.Name(name), traits.Pose(pose), traits.DrawAPI, traits.ReferenceFrame)

			const entity = world.spawn(...entityTraits)

			entities.set(name, entity)
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const drawGeometry = (data: any, color: string, parent?: string) => {
		const name = data.label ?? `geometry ${++geometryIndex}`
		const pose = createPose(data.center)
		const existing = entities.get(name)

		if (existing) {
			existing.set(traits.Pose, pose)
			return
		}

		const geometryTrait = () => {
			if ('mesh' in data) {
				const geometry = parsePlyInput(data.mesh.mesh)
				return traits.BufferGeometry(geometry)
			} else if ('box' in data) {
				return traits.Box(createBox(data.box))
			} else if ('sphere' in data) {
				return traits.Sphere(createSphere(data.sphere))
			} else if ('capsule' in data) {
				return traits.Capsule(createCapsule(data.capsule))
			}

			return traits.ReferenceFrame
		}

		const entityTraits: ConfigurableTrait[] = []

		if (parent && parent !== 'world') {
			entityTraits.push(traits.Parent(parent))
		}

		entityTraits.push(
			traits.Name(data.label ?? ++geometryIndex),
			traits.Pose(pose),
			traits.Color(colorUtil.set(color)),
			geometryTrait(),
			traits.DrawAPI
		)

		const entity = world.spawn(...entityTraits)

		entities.set(name, entity)
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const drawNurbs = (data: any, color: string) => {
		const name = data.Name
		const existing = entities.get(name)

		const controlPoints = data.ControlPts.map(
			(point: Vector3) => new Vector4(point.x / 1000, point.y / 1000, point.z / 1000)
		)
		const curve = new NURBSCurve(data.Degree, data.Knots, controlPoints)

		const numPoints = 600
		const points = new Float32Array(numPoints * 3)
		const l = numPoints * 3
		for (let i = 0; i < l; i += 3) {
			curve.getPointAt(i / (l - 1), vec3)
			points[i + 0] = vec3.x
			points[i + 1] = vec3.y
			points[i + 2] = vec3.z
		}

		if (existing) {
			existing.set(traits.LinePositions, points)
			return
		}

		const entity = world.spawn(
			traits.Name(name),
			traits.Color(colorUtil.set(color)),
			traits.LinePositions(points),
			traits.DrawAPI
		)

		entities.set(name, entity)
	}

	const vec3 = new Vector3()

	const drawPoses = async (reader: BinaryReader) => {
		// Read counts
		const nPoints = reader.read()
		const nColors = reader.read()

		const arrowHeadAtPose = reader.read()

		const entities: Entity[] = []

		const entity = world.spawn(
			traits.Name(`Arrow group ${++poseIndex}`),
			traits.Positions(reader.readF32Array(nPoints * STRIDE.ARROWS)),
			traits.Colors(reader.readU8Array(nColors * STRIDE.COLORS_RGB)),
			traits.Arrows({ headAtPose: arrowHeadAtPose === 1 }),
			traits.DrawAPI
		)

		entities.push(entity)
	}

	const drawPoints = async (reader: BinaryReader) => {
		// Read label length
		const labelLen = reader.read()
		let label = ''
		for (let i = 0; i < labelLen; i++) {
			label += String.fromCharCode(reader.read())
		}

		// Read counts
		const nPoints = reader.read()
		const nColors = reader.read()

		// Read default color
		const r = reader.read()
		const g = reader.read()
		const b = reader.read()

		const nPointsElements = nPoints * 3
		const positions = reader.readF32Array(nPointsElements)

		const nColorsElements = nColors * 3
		const rawColors = reader.readF32Array(nColorsElements)

		const colors = new Float32Array(nPointsElements)
		colors.set(rawColors)

		// Cover the gap for any points not colored
		for (let i = nColors; i < nPoints; i++) {
			const offset = i * 3

			colors[offset] = r
			colors[offset + 1] = g
			colors[offset + 2] = b
		}

		const entities = world.query(traits.DrawAPI)
		const entity = entities.find((entity) => entity.get(traits.Name) === label)

		if (entity) {
			const geometry = entity.get(traits.BufferGeometry)

			if (geometry) {
				updateBufferGeometry(geometry, positions, colors)
				return
			}
		}

		const geometry = createBufferGeometry(positions, colors)

		world.spawn(
			traits.Name(label),
			traits.Color(colorUtil.set(r, g, b)),
			traits.BufferGeometry(geometry),
			traits.Points,
			traits.DrawAPI
		)
	}

	const drawLine = async (reader: BinaryReader) => {
		// Read label length
		const labelLen = reader.read()
		let label = ''
		for (let i = 0; i < labelLen; i++) {
			label += String.fromCharCode(reader.read())
		}

		const entities = world.query(traits.DrawAPI)
		const entity = entities.find((entity) => entity.get(traits.Name) === label)
		entity?.destroy()

		// Read counts
		const nPoints = reader.read()

		// Read default color
		const r = reader.read()
		const g = reader.read()
		const b = reader.read()

		const dotR = reader.read()
		const dotG = reader.read()
		const dotB = reader.read()

		// Read positions
		const points = new Float32Array(nPoints * 3)
		for (let i = 0; i < nPoints * 3; i += 3) {
			points[i + 0] = reader.read()
			points[i + 1] = reader.read()
			points[i + 2] = reader.read()
		}

		world.spawn(
			traits.Name(label),
			traits.Color({ r, g, b }),
			traits.LinePositions(points),
			traits.PointColor({ r: dotR, g: dotG, b: dotB }),
			traits.DrawAPI
		)
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const drawGeometries = (geometries: any[], colors: string[], parent: string) => {
		let i = 0
		for (const geometry of geometries) {
			drawGeometry(geometry, colors[i], parent)
			i += 1
		}
	}

	const drawGLTF = async (buffer: ArrayBuffer) => {
		const blob = new Blob([buffer], { type: 'model/gltf-binary' })
		const url = URL.createObjectURL(blob)
		const gltf = await loader.loadAsync(url)

		world.spawn(
			traits.Name(gltf.scene.name),
			traits.GLTF({ source: { gltf }, animationName: '' }),
			traits.DrawAPI
		)

		URL.revokeObjectURL(url)
	}

	const remove = (names: string[]) => {
		for (const name of names) {
			for (const entity of world.query(traits.DrawAPI)) {
				if (entity.get(traits.Name) === name) {
					entity.destroy()
					entities.delete(name)
				}
			}
		}
	}

	const removeAll = () => {
		for (const entity of world.query(traits.DrawAPI)) {
			entity.destroy()
		}

		entities.clear()

		geometryIndex = 0
		poseIndex = 0
	}

	const scheduleReconnect = () => {
		setTimeout(() => {
			if (backendIP && websocketPort) {
				reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay)
				logs.add(`Reconnecting to drawing server in ${reconnectDelay / 1000} seconds...`, 'warn')

				connect(backendIP, websocketPort)
			} else {
				logs.add('No provided backend IP or websocket port', 'error')
			}
		}, reconnectDelay)
	}

	const onOpen = () => {
		connectionStatus = 'open'
		reconnectDelay = 1000
		logs.add(`Connected to drawing server at ${backendIP}:${websocketPort}`)
	}

	const onClose = () => {
		connectionStatus = 'closed'
		logs.add('Disconnected from drawing server', 'warn')
		scheduleReconnect()
	}

	const onError = (event: Event) => {
		const stringified = JSON.stringify(event)

		ws?.close()

		if (stringified === '{"isTrusted":true}') {
			return
		}

		logs.add(`Drawing server error: ${JSON.stringify(event)}`, 'error')
	}

	const onMessage = async (event: MessageEvent) => {
		let operation = 'UNKNOWN'
		let requestID = ''

		try {
			if (typeof event.data === 'object' && 'arrayBuffer' in event.data) {
				const reader = await new BinaryReader().init(event.data)

				requestID = reader.header.requestID

				const { type } = reader.header

				if (type === bufferTypes.DRAW_POINTS) {
					operation = 'DrawPoints'
					drawPoints(reader)
				} else if (type === bufferTypes.DRAW_POSES) {
					operation = 'DrawPoses'
					drawPoses(reader)
				} else if (type === bufferTypes.DRAW_LINE) {
					operation = 'DrawLine'
					drawLine(reader)
				} else if (type === bufferTypes.DRAW_GLTF) {
					operation = 'DrawGLTF'
					drawGLTF(reader.buffer)
				} else {
					throw new Error('Invalid buffer')
				}
			} else {
				const [error, data] = tryParse(event.data)

				if (error) {
					logs.add(`Failed to parse JSON from drawing server: ${JSON.stringify(error)}`, 'error')
					throw new Error(`Failed to parse JSON from drawing server: ${JSON.stringify(error)}`)
				}

				if (!data) {
					throw new Error('No drawing data sent to client.')
				}

				requestID = data.requestID

				if ('setCameraPose' in data) {
					operation = 'SetCameraPose'
					cameraControls.setPose(
						{
							position: [data.Position.X, data.Position.Y, data.Position.Z],
							lookAt: [data.LookAt.X, data.LookAt.Y, data.LookAt.Z],
						},
						data.Animate
					)
				} else if ('geometries' in data) {
					operation = 'DrawGeometries'
					drawGeometries(data.geometries, data.colors, data.parent)
				} else if ('geometry' in data) {
					operation = 'DrawGeometry'
					drawGeometry(data.geometry, data.color)
				} else if ('frames' in data) {
					operation = 'DrawFrames'
					drawFrames(data.frames)
				} else if ('Knots' in data) {
					operation = 'DrawNurbs'
					drawNurbs(data, data.Color)
				} else if ('remove' in data) {
					operation = 'Remove'
					remove(data.names)
				} else if ('removeAll' in data) {
					operation = 'RemoveAll'
					removeAll()
				}
			}

			sendResponse({ code: 200, requestID, message: `${operation} succeeded.` })
		} catch (error) {
			logs.add(`${error}`, 'error')
			sendResponse({
				code: 500,
				requestID,
				message: `${operation} failed. Reason: ${error}`,
			})
		}

		invalidate()
	}

	const connect = (backendIP: string, websocketPort: string) => {
		const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
		ws = new WebSocket(`${protocol}://${backendIP}:${websocketPort}/ws`)
		ws.onclose = onClose
		ws.onerror = onError
		ws.onopen = onOpen
		ws.onmessage = onMessage
	}

	const disconnect = () => {
		ws?.removeEventListener('close', onClose)
		ws?.removeEventListener('error', onError)
		ws?.removeEventListener('open', onOpen)
		ws?.removeEventListener('message', onMessage)
		ws?.close()
		ws = undefined
	}

	$effect(() => {
		if (!backendIP || !websocketPort) {
			return
		}

		connect(backendIP, websocketPort)

		return () => {
			disconnect()
		}
	})

	setContext<Context>(key, {
		get connectionStatus() {
			return connectionStatus
		},
	})
}

export const useDrawAPI = () => {
	return getContext<Context>(key)
}

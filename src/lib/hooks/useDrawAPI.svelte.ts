import { getContext, setContext } from 'svelte'
import { Color, Vector3, Vector4 } from 'three'
import { NURBSCurve } from 'three/addons/curves/NURBSCurve.js'
import { UuidTool } from 'uuid-tool'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Frame } from '$lib/frame'
import { createPose, createPoseFromFrame } from '$lib/transform'
import { useCameraControls } from './useControls.svelte'
import { useWorld, traits } from '$lib/ecs'
import { useThrelte } from '@threlte/core'
import { trait, type ConfigurableTrait, type Entity } from 'koota'
import { parsePlyInput } from '$lib/ply'
import { useLogs } from './useLogs.svelte'

const vec3 = new Vector3()
const colorUtil = new Color()

type ConnectionStatus = 'connecting' | 'open' | 'closed'

interface Context {
	connectionStatus: ConnectionStatus

	addPoints(entity: Entity): void
	addMesh(entity: Entity): void
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

class Float32Reader {
	littleEndian = true
	offset = 0
	buffer = new ArrayBuffer()
	view = new DataView(this.buffer)
	header = { requestID: '', type: -1 }

	async init(data: Blob) {
		this.buffer = await data.arrayBuffer()
		this.header = {
			requestID: UuidTool.toString([...new Uint8Array(this.buffer.slice(0, 16))]),
			type: new DataView(this.buffer).getFloat32(16, true),
		}

		// Slice away the request header and leave the body
		this.buffer = this.buffer.slice(20)
		this.view = new DataView(this.buffer)
		return this
	}

	read() {
		const result = this.view.getFloat32(this.offset, this.littleEndian)
		this.offset += 4
		return result
	}
}

export const provideDrawAPI = () => {
	const world = useWorld()
	const logs = useLogs()
	const cameraControls = useCameraControls()
	const { invalidate } = useThrelte()

	let pointsIndex = 0
	let geometryIndex = 0
	let poseIndex = 0

	let reconnectDelay = 200

	const maxReconnectDelay = 5_000

	let ws: WebSocket

	let connectionStatus = $state<ConnectionStatus>('connecting')

	const direction = new Vector3()
	const origin = new Vector3()
	const loader = new GLTFLoader()
	const entities = new Map<string, Entity>()

	const sendResponse = (response: { requestID: string; code: number; message: string }) => {
		ws.send(JSON.stringify(response))
	}

	const drawFrames = async (data: Frame[]) => {
		for (const rawFrame of data) {
			const frame = lowercaseKeys(rawFrame) as Frame
			const pose = createPoseFromFrame(frame)
			const name = frame.name ?? ''
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
					return traits.Box({
						x: frame.geometry.x * 0.001,
						y: frame.geometry.y * 0.001,
						z: frame.geometry.z * 0.001,
					})
				} else if (frame.geometry?.type === 'sphere') {
					return traits.Sphere({ r: frame.geometry.r * 0.001 })
				} else if (frame.geometry?.type === 'capsule') {
					return traits.Capsule({ r: frame.geometry.r * 0.001, l: frame.geometry.l * 0.001 })
				}

				return trait()
			}

			const entityTraits: ConfigurableTrait[] = []

			if (parent && parent !== 'world') {
				entityTraits.push(traits.Parent(parent))
			}

			if (frame.geometry) {
				entityTraits.push(geometryTrait())
			}

			entityTraits.push(traits.UUID, traits.Name(frame.name), traits.Pose(pose), traits.DrawAPI)

			const entity = world.spawn(...entityTraits)

			entities.set(name, entity)
		}
	}

	const drawPCD = async (buffer: ArrayBuffer) => {
		const { positions, colors } = await parsePcdInWorker(new Uint8Array(buffer))

		const entity = world.spawn(
			traits.UUID,
			traits.Name(`Points ${++pointsIndex}`),
			traits.PointsGeometry(positions),
			traits.DrawAPI
		)

		if (colors) {
			entity.add(traits.VertexColors(colors as Float32Array<ArrayBuffer>))
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
				return traits.BufferGeometry(parsePlyInput(data.mesh.mesh))
			} else if ('box' in data) {
				return traits.Box({
					x: data.box.dimsMm.x * 0.001,
					y: data.box.dimsMm.y * 0.001,
					z: data.box.dimsMm.z * 0.001,
				})
			} else if ('sphere' in data) {
				return traits.Sphere({ r: data.sphere.radiusMm * 0.001 })
			} else if ('capsule' in data) {
				return traits.Capsule({
					r: data.capsule.radiusMm * 0.001,
					l: data.capsule.lengthMm * 0.001,
				})
			}

			return trait()
		}

		const entityTraits: ConfigurableTrait[] = []

		if (parent && parent !== 'world') {
			entityTraits.push(traits.Parent(parent))
		}

		entityTraits.push(
			traits.UUID,
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
		const points = curve.getPoints(200)

		if (existing) {
			existing.set(traits.LineGeometry, points)
			return
		}

		const entity = world.spawn(
			traits.UUID,
			traits.Name(name),
			traits.Color(colorUtil.set(color)),
			traits.LineGeometry(points),
			traits.DrawAPI
		)

		entities.set(name, entity)
	}

	const pose = createPose()
	const drawPoses = async (reader: Float32Reader) => {
		// Read counts
		const nPoints = reader.read()
		const nColors = reader.read()
		const arrowHeadAtPose = reader.read()

		const entities: Entity[] = []

		for (let i = 0; i < nPoints; i += 1) {
			origin.set(reader.read(), reader.read(), reader.read()).multiplyScalar(0.001)
			direction.set(reader.read(), reader.read(), reader.read())

			pose.x = origin.x
			pose.y = origin.y
			pose.z = origin.z
			pose.oX = direction.x
			pose.oY = direction.y
			pose.oZ = direction.z

			const entity = world.spawn(
				traits.UUID,
				traits.Name(`Pose ${++poseIndex}`),
				traits.Pose(pose),
				traits.Instance,
				traits.Color,
				traits.Arrow,
				traits.DrawAPI
			)

			entities.push(entity)
		}

		for (let i = 0; i < nColors; i += 1) {
			const entity = entities[i]
			colorUtil.set(reader.read(), reader.read(), reader.read())
			entity.set(traits.Color, colorUtil)
		}
	}

	const drawPoints = async (reader: Float32Reader) => {
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
		const nColors = reader.read()

		// Read default color
		const r = reader.read()
		const g = reader.read()
		const b = reader.read()

		// Read positions
		const positions = new Float32Array(nPoints * 3)
		for (let i = 0; i < nPoints * 3; i++) {
			positions[i] = reader.read()
		}

		const getColors = () => {
			// Read raw colors
			const rawColors = new Float32Array(nColors * 3)
			for (let i = 0; i < nColors * 3; i++) {
				rawColors[i] = reader.read()
			}

			const colors = new Float32Array(nPoints * 3)
			colors.set(rawColors)

			// Cover the gap for any points not colored
			for (let i = nColors; i < nPoints; i++) {
				const offset = i * 3

				colors[offset] = r
				colors[offset + 1] = g
				colors[offset + 2] = b
			}

			return colors
		}

		world.spawn(
			traits.UUID,
			traits.Name(label),
			traits.Color(colorUtil.set(r, g, b)),
			traits.PointsGeometry(positions),
			traits.VertexColors(getColors()),
			traits.DrawAPI
		)
	}

	const drawLine = async (reader: Float32Reader) => {
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
		const points: Vector3[] = []
		for (let i = 0; i < nPoints * 3; i += 3) {
			points.push(new Vector3(reader.read(), reader.read(), reader.read()))
		}

		world.spawn(
			traits.UUID,
			traits.Name(label),
			traits.Color({ r, g, b }),
			traits.LineGeometry(points),
			traits.DottedLineColor({ r: dotR, g: dotG, b: dotB }),
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

		world.spawn(traits.UUID, traits.Name(gltf.scene.name), traits.GLTF(gltf), traits.DrawAPI)

		URL.revokeObjectURL(url)
	}

	const remove = (names: string[]) => {
		for (const name of names) {
			for (const entity of world.query(traits.DrawAPI)) {
				if (entity.get(traits.Name) === name) {
					entity.destroy()
				}
			}
		}
	}

	const removeAll = () => {
		for (const entity of world.query(traits.DrawAPI)) {
			entity.destroy()
		}

		pointsIndex = 0
		geometryIndex = 0
		poseIndex = 0
	}

	const { BACKEND_IP, BUN_SERVER_PORT } = globalThis as unknown as {
		BACKEND_IP?: string
		BUN_SERVER_PORT?: string
	}

	const scheduleReconnect = () => {
		setTimeout(() => {
			reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay)
			logs.add(`Reconnecting to drawing server in ${reconnectDelay / 1000} seconds...`, 'warn')
			connect()
		}, reconnectDelay)
	}

	const onOpen = () => {
		connectionStatus = 'open'
		reconnectDelay = 1000
		logs.add(`Connected to drawing server at ${BACKEND_IP}:${BUN_SERVER_PORT}`)
	}

	const onClose = () => {
		connectionStatus = 'closed'
		logs.add('Disconnected from drawing server', 'warn')
		scheduleReconnect()
	}

	const onError = (event: Event) => {
		const stringified = JSON.stringify(event)

		ws.close()

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
				const reader = await new Float32Reader().init(event.data)

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
				} else if (type === bufferTypes.DRAW_PCD) {
					operation = 'DrawPCD'
					drawPCD(reader.buffer)
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

	const connect = () => {
		if (BACKEND_IP && BUN_SERVER_PORT) {
			const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
			ws = new WebSocket(`${protocol}://${BACKEND_IP}:${BUN_SERVER_PORT}/ws`)
			ws.onclose = onClose
			ws.onerror = onError
			ws.onopen = onOpen
			ws.onmessage = onMessage
		}
	}

	connect()

	setContext<Context>(key, {
		get connectionStatus() {
			return connectionStatus
		},
		addPoints(entity: Entity) {},
		addMesh(entity: Entity) {},
	})
}

export const useDrawAPI = () => {
	return getContext<Context>(key)
}

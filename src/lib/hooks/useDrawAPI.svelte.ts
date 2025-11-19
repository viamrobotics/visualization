import { getContext, setContext } from 'svelte'
import { Color, Vector3, Vector4, Quaternion, MathUtils } from 'three'
import type { OBB } from 'three/addons/math/OBB.js'
import { NURBSCurve } from 'three/addons/curves/NURBSCurve.js'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { WorldObject, type PointsGeometry } from '$lib/WorldObject.svelte'
import { useArrows } from './useArrows.svelte'
import type { Frame } from '$lib/frame'
import { createGeometry } from '$lib/geometry'
import { createPose, createPoseFromFrame, poseToQuaternion, poseToVector3 } from '$lib/transform'
import { useCameraControls } from './useControls.svelte'
import { useWorld, traits } from '$lib/ecs'
import { OrientationVector } from '$lib/lib'
import { useThrelte } from '@threlte/core'
import { trait, type ConfigurableTrait, type Entity } from 'koota'
import { parsePlyInput } from '$lib/ply'

const colorUtil = new Color()
const ov = new OrientationVector()
const vec3 = new Vector3()
const quaternion = new Quaternion()

type ConnectionStatus = 'connecting' | 'open' | 'closed'

interface Context {
	connectionStatus: ConnectionStatus

	addPoints(entity: Entity): void
	addMesh(entity: Entity): void
}

const key = Symbol('draw-api-context-key')

const tryParse = (json: string) => {
	try {
		return JSON.parse(json)
	} catch (error) {
		console.warn('Failed to parse JSON:', error)
		return
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

	async init(data: Blob) {
		this.buffer = await data.arrayBuffer()
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
	const cameraControls = useCameraControls()
	const batchedArrow = useArrows()
	const { invalidate } = useThrelte()

	let pointsIndex = 0
	let geometryIndex = 0
	let poseIndex = 0

	let reconnectDelay = 200

	const maxReconnectDelay = 5_000

	let ws: WebSocket

	let connectionStatus = $state<ConnectionStatus>('connecting')

	const color = new Color()
	const direction = new Vector3()
	const origin = new Vector3()
	const loader = new GLTFLoader()

	const drawFrames = async (data: Frame[]) => {
		for (const rawFrame of data) {
			const frame = lowercaseKeys(rawFrame) as Frame
			const pose = createPoseFromFrame(frame)

			const entityTraits: ConfigurableTrait[] = [
				traits.UUID,
				traits.Name(frame.name),
				traits.Parent(frame.parent),
				traits.Pose(pose),
				traits.DrawAPI,
			]

			if (frame.geometry?.type === 'box') {
				entityTraits.push(
					traits.Box({
						x: frame.geometry.x * 0.001,
						y: frame.geometry.y * 0.001,
						z: frame.geometry.z * 0.001,
					})
				)
			} else if (frame.geometry?.type === 'sphere') {
				entityTraits.push(traits.Sphere({ r: frame.geometry.r * 0.001 }))
			} else if (frame.geometry?.type === 'capsule') {
				entityTraits.push(
					traits.Capsule({ r: frame.geometry.r * 0.001, l: frame.geometry.l * 0.001 })
				)
			}

			world.spawn(...entityTraits)
		}
	}

	const drawPCD = async (buffer: ArrayBuffer) => {
		const { positions, colors } = await parsePcdInWorker(new Uint8Array(buffer))

		const entity = world.spawn(
			traits.UUID,
			traits.Name(`points ${++pointsIndex}`),
			traits.PointsGeometry(positions),
			traits.DrawAPI
		)

		if (colors) {
			entity.add(traits.VertexColors(colors as Float32Array<ArrayBuffer>))
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const drawGeometry = (data: any, color: string, parent?: string) => {
		const entities = world.query(traits.DrawAPI)
		const existingEntity = entities.find((entity) => entity.get(traits.Name) === data.label)
		const pose = createPose(data.center)

		if (existingEntity) {
			existingEntity.set(traits.Pose, pose)
			return
		}

		const entity = world.spawn(
			traits.UUID,
			traits.Name(data.label ?? ++geometryIndex),
			traits.Parent(parent),
			traits.Pose(pose),
			traits.Color(colorUtil.set(color)),
			traits.DrawAPI
		)

		if ('mesh' in data) {
			entity.add(traits.BufferGeometry(parsePlyInput(data.mesh.mesh)))
		} else if ('box' in data) {
			entity.add(
				traits.Box({
					x: data.box.dimsMm.x * 0.001,
					y: data.box.dimsMm.y * 0.001,
					z: data.box.dimsMm.z * 0.001,
				})
			)
		} else if ('sphere' in data) {
			entity.add(traits.Sphere({ r: data.sphere.radiusMm * 0.001 }))
		} else if ('capsule' in data) {
			entity.add(
				traits.Capsule({ r: data.capsule.radiusMm * 0.001, l: data.capsule.lengthMm * 0.001 })
			)
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const drawNurbs = (data: any, color: string) => {
		const entities = world.query(traits.DrawAPI)
		const entity = entities.find((entity) => entity.get(traits.Name) === data.name)
		entity?.destroy()

		const controlPoints = data.ControlPts.map(
			(point: Vector3) => new Vector4(point.x / 1000, point.y / 1000, point.z / 1000)
		)
		const curve = new NURBSCurve(data.Degree, data.Knots, controlPoints)
		const points = curve.getPoints(200)

		world.spawn(
			traits.UUID,
			traits.Name(data.Name),
			traits.Color(colorUtil.set(color)),
			traits.LineGeometry(points),
			traits.DrawAPI
		)
	}

	const drawPoses = async (reader: Float32Reader) => {
		// Read counts
		const nPoints = reader.read()
		const nColors = reader.read()
		const arrowHeadAtPose = reader.read()

		const eids: number[] = []

		const arrowTraits = [
			traits.UUID,
			traits.Name,
			traits.Pose,
			traits.Instance,
			traits.Color,
			traits.Arrow,
			traits.DrawAPI,
		] as const

		for (let i = 0; i < nPoints; i += 1) {
			const entity = world.spawn(...arrowTraits)
			eids.push(entity.id())
		}

		world
			.query(...arrowTraits)
			.select(traits.Name, traits.Pose, traits.Instance)
			.useStores(([names, poses, instances]) => {
				for (let i = 0; i < nPoints; i += 1) {
					const eid = eids[i]

					names[eid] = `pose ${++poseIndex}`
					poses.x[eid] = reader.read()
					poses.y[eid] = reader.read()
					poses.z[eid] = reader.read()

					ov.set(reader.read(), reader.read(), reader.read())
					ov.toQuaternion(quaternion)
					poses.oX[eid] = ov.x
					poses.oY[eid] = ov.y
					poses.oZ[eid] = ov.z
					poses.theta[eid] = ov.th

					instances[eid] = batchedArrow.addArrow(
						origin.set(ov.x, ov.y, ov.z),
						direction.set(poses.x[eid], poses.y[eid], poses.z[eid]),
						undefined,
						undefined,
						arrowHeadAtPose === 1
					)
				}
			})

		// @todo interleave to avoid a second loop
		world
			.query(...arrowTraits)
			.select(traits.Instance, traits.Color)
			.useStores(([instances, colors]) => {
				for (let i = 0; i < nColors; i += 1) {
					const eid = eids[i]
					colors.r[eid] = reader.read()
					colors.g[eid] = reader.read()
					colors.b[eid] = reader.read()

					batchedArrow.mesh.setColorAt(
						instances[eid],
						color.setRGB(colors.r[eid], colors.g[eid], colors.b[eid])
					)
				}
			})

		invalidate()
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
					const id = entity.get(traits.Instance)
					if (id) {
						batchedArrow.removeArrow(id)
					}
					entity.destroy()
				}
			}
		}
	}

	const removeAll = () => {
		for (const entity of world.query(traits.DrawAPI)) {
			const id = entity.get(traits.Instance)
			if (id) {
				batchedArrow.removeArrow(id)
			}
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
			console.log(`Reconnecting in ${reconnectDelay / 1000} seconds...`)
			connect()
		}, reconnectDelay)
	}

	const onOpen = () => {
		connectionStatus = 'open'
		reconnectDelay = 1000
		console.log(`Connected to websocket server at ${BACKEND_IP}:${BUN_SERVER_PORT}`)
	}

	const onClose = () => {
		connectionStatus = 'closed'
		console.log('Disconnected from websocket server')
		scheduleReconnect()
	}

	const onError = (event: Event) => {
		console.log('Websocket error', JSON.stringify(event))
		ws.close()
	}

	const onMessage = async (event: MessageEvent) => {
		if (typeof event.data === 'object' && 'arrayBuffer' in event.data) {
			const reader = await new Float32Reader().init(event.data)
			const type = reader.read()

			if (type === 0) {
				return drawPoints(reader)
			} else if (type === 1) {
				return drawPoses(reader)
			} else if (type === 2) {
				return drawLine(reader)
			} else if (type === 3) {
				return drawPCD(reader.buffer)
			} else {
				return drawGLTF(reader.buffer)
			}
		}

		const data = tryParse(event.data)

		if (!data) return

		if ('setCameraPose' in data) {
			cameraControls.setPose(
				{
					position: [data.Position.X, data.Position.Y, data.Position.Z],
					lookAt: [data.LookAt.X, data.LookAt.Y, data.LookAt.Z],
				},
				data.Animate
			)

			return
		}

		if ('geometries' in data) {
			return drawGeometries(data.geometries, data.colors, data.parent)
		}

		if ('geometry' in data) {
			return drawGeometry(data.geometry, data.color)
		}

		if ('frames' in data) {
			return drawFrames(data.frames)
		}

		if ('Knots' in data) {
			return drawNurbs(data, data.Color)
		}

		if ('remove' in data) {
			return remove(data.names)
		}

		if ('removeAll' in data) {
			return removeAll()
		}
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

import { trait } from 'koota'
import { MathUtils, BufferGeometry as ThreeBufferGeometry } from 'three'

export const UUID = trait(() => MathUtils.generateUUID())
export const Name = trait(() => '')
export const Parent = trait(() => 'world')

export const Pose = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 0, theta: 0 })
export const EditedPose = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 0, theta: 0 })
export const Center = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 0, theta: 0 })

export const Instance = trait(() => 0)
export const Opacity = trait(() => 1)
export const Color = trait({ r: 0, g: 0, b: 0 })

export const Arrow = trait()

export const Box = trait({ x: 0, y: 0, z: 0 })
export const Capsule = trait({ l: 0, r: 0 })
export const Sphere = trait({ r: 0 })

// Handles for typed arrays
export const PointsGeometry = trait(() => new Float32Array())
export const BufferGeometry = trait(() => new ThreeBufferGeometry())
export const LineGeometry = trait(() => new Float32Array())
export const VertexColors = trait(() => new Float32Array())

// Files
export const GLTF = trait(() => ({}) as any)

// Objects created with the draw API
export const DrawAPI = trait()

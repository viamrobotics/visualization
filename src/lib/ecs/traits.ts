import { trait } from 'koota'

export const UUID = trait({ uuid: '' })
export const Name = trait({ name: '' })
export const Parent = trait({ parent: 'world' })

export const Position = trait({ x: 0, y: 0, z: 0 })
export const Quaternion = trait({ x: 0, y: 0, z: 0, w: 0 })
export const EditedPose = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 0, theta: 0 })

export const Instance = trait({ id: 0 })
export const Color = trait({ r: 0, g: 0, b: 0, a: 1 })

export const Arrow = trait()

export const Box = trait({ x: 0, y: 0, z: 0 })
export const Capsule = trait({ l: 0, r: 0 })
export const Sphere = trait({ r: 0 })

// Handles for typed arrays
export const PointsGeometry = trait()
export const BufferGeometry = trait()
export const LineGeometry = trait()
export const VertexColors = trait()

export const GLTF = trait()

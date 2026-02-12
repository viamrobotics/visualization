import type { Geometry } from '@viamrobotics/sdk'
import type { BufferGeometry } from 'three'

export type ThreeBufferGeometry = {
	center: undefined
	geometryType: { case: 'bufferGeometry'; value: BufferGeometry }
}

export type Geometries = Geometry | ThreeBufferGeometry

import { Box3, Camera, Plane, Raycaster, Triangle, Vector2, Vector3 } from "three"

import type * as selectionTraits from './traits'

const raycaster = new Raycaster()
const mouse = new Vector2()
const plane = new Plane(new Vector3(0, 0, 1), 0)
const point = new Vector3()

const triangle = new Triangle()
const box3 = new Box3()
const a = new Vector3()
const b = new Vector3()
const c = new Vector3()

export const raycast = (event: PointerEvent, camera: Camera): Vector3 => {
    const element = event.target as HTMLElement
    const rect = element.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    raycaster.ray.intersectPlane(plane, point)
    return point
}

export const getTriangleFromIndex = (i: number, indices: number[], positions: Float32Array, outTriangle: Triangle): void => {
    const stride = 3
    const ia = indices[i + 0] * stride
    const ib = indices[i + 1] * stride
    const ic = indices[i + 2] * stride
    a.set(positions[ia + 0], positions[ia + 1], positions[ia + 2])
    b.set(positions[ib + 0], positions[ib + 1], positions[ib + 2])
    c.set(positions[ic + 0], positions[ic + 1], positions[ic + 2])
    outTriangle.set(a, b, c)
}

export const getTriangleBoxesFromIndices = (indices: number[], positions: Float32Array): selectionTraits.AABB[] => {
    const boxes: selectionTraits.AABB[] = []
    for (let i = 0, l = indices.length; i < l; i += 3) {
        getTriangleFromIndex(i, indices, positions, triangle)
        box3.setFromPoints([triangle.a, triangle.b, triangle.c])
        boxes.push({ minX: box3.min.x, minY: box3.min.y, maxX: box3.max.x, maxY: box3.max.y })
    }
    return boxes
}
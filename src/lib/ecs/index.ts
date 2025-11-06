import { trait } from 'koota'

export { provideWorld, useWorld } from './useWorld'
// export { useQuery } from './useQuery'

export const Name = trait({ name: '' })
export const Parent = trait({ parent: 'world' })
export const Position = trait({ x: 0, y: 0, z: 0 })
export const Quaternion = trait({ x: 0, y: 0, z: 0, w: 0 })
export const Color = trait({ r: 0, g: 0, b: 0, a: 1 })
export const Arrow = trait()
export const Instance = trait({ id: 0 })

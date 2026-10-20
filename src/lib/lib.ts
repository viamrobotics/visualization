// Components exported here must be pure and use no hooks. Add a case to
// src/lib/__tests__/PureComponents.svelte.spec.ts asserting the component renders
// without its parent providers.
export { default as AxesHelper } from './components/AxesHelper.svelte'

// Snapshot component (uses context, requires MotionTools parent)
export { default as Snapshot } from './components/Snapshot.svelte'
export { Snapshot as SnapshotProto } from '$lib/buf/draw/v1/snapshot_pb'

export { BatchedArrow } from './three/BatchedArrow'
export { CapsuleGeometry } from './three/CapsuleGeometry'
export { OrientationVector } from './math/OrientationVector'

export { parsePcdInWorker } from './loaders/pcd'
export { createBinaryPCD } from './pcd'
export { metadataFromStruct } from './metadata'
export { decodeDrawnSnapshotPointClouds } from './snapshot'

import type { InstancedMesh2 } from '@three.ez/instanced-mesh'

import { render } from '@testing-library/svelte'
import { createWorld, type World } from 'koota'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MockCanvas from '$lib/__tests__/fixtures/MockCanvas.svelte'
import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'

vi.mock('@threlte/core', async () => {
	const actual = await vi.importActual('@threlte/core')
	return {
		...actual,
		currentWritable: vi.fn(() => ({
			subscribe: () => () => {},
			set: () => {},
			update: () => {},
		})),
	}
})

vi.mock('@threlte/extras', async () => {
	const actual = await vi.importActual('@threlte/extras')
	return {
		...actual,
		useCursor: vi.fn(() => ({ onPointerEnter: vi.fn(), onPointerLeave: vi.fn() })),
	}
})

vi.mock('three', async () => {
	const actual = await vi.importActual('three')
	return {
		...actual,
		WebGLRenderer: vi.fn().mockImplementation(() => ({
			setSize: vi.fn(),
			setPixelRatio: vi.fn(),
			render: vi.fn(),
			domElement: {
				getContext: vi.fn().mockReturnValue({}),
			},
			dispose: vi.fn(),
		})),
	}
})

vi.mock('$lib/hooks/useSettings.svelte', () => ({
	useSettings: () => ({ current: { renderMode: 'toon' } }),
}))

// Tracks every `InstancedMesh2` a renderer constructs so a spec can inspect the
// per-instance visibility it wrote, without exposing the renderer's internal
// module-scope meshes as a prop.
const constructedMeshes: InstancedMesh2[] = []
vi.mock('@three.ez/instanced-mesh', async () => {
	const actual = await vi.importActual<typeof import('@three.ez/instanced-mesh')>(
		'@three.ez/instanced-mesh'
	)
	class TrackedInstancedMesh2 extends actual.InstancedMesh2 {
		constructor(...args: ConstructorParameters<typeof actual.InstancedMesh2>) {
			super(...args)
			constructedMeshes.push(this)
		}
	}
	return { ...actual, InstancedMesh2: TrackedInstancedMesh2 }
})

globalThis.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const flush = async () => {
	await tick()
	await Promise.resolve()
	await Promise.resolve()
}

describe('instanced geometry wireframe visibility', () => {
	let world: World

	beforeEach(() => {
		world = createWorld()
		constructedMeshes.length = 0
	})

	afterEach(() => {
		world.destroy()
	})

	it('hides Boxes faces but keeps edges shown for a wireframe entity', async () => {
		const { default: Boxes } = await import('../Boxes.svelte')
		world.spawn(traits.Box({ x: 200, y: 200, z: 200 }), traits.WorldMatrix(), traits.Wireframe())

		const { unmount } = render(MockCanvas, {
			props: { child: Boxes },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		await flush()

		const [faces, edges] = constructedMeshes
		expect(faces.getVisibilityAt(0)).toBe(false)
		expect(edges.getVisibilityAt(0)).toBe(true)

		unmount()
		await flush()
	})

	it('shows both Boxes faces and edges for a non-wireframe entity', async () => {
		const { default: Boxes } = await import('../Boxes.svelte')
		world.spawn(traits.Box({ x: 200, y: 200, z: 200 }), traits.WorldMatrix())

		const { unmount } = render(MockCanvas, {
			props: { child: Boxes },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		await flush()

		const [faces, edges] = constructedMeshes
		expect(faces.getVisibilityAt(0)).toBe(true)
		expect(edges.getVisibilityAt(0)).toBe(true)

		unmount()
		await flush()
	})

	it('hides Spheres faces but keeps edges shown for a wireframe entity', async () => {
		const { default: Spheres } = await import('../Spheres.svelte')
		world.spawn(traits.Sphere({ r: 200 }), traits.WorldMatrix(), traits.Wireframe())

		const { unmount } = render(MockCanvas, {
			props: { child: Spheres },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		await flush()

		const [faces, edges] = constructedMeshes
		expect(faces.getVisibilityAt(0)).toBe(false)
		expect(edges.getVisibilityAt(0)).toBe(true)

		unmount()
		await flush()
	})

	it('shows both Spheres faces and edges for a non-wireframe entity', async () => {
		const { default: Spheres } = await import('../Spheres.svelte')
		world.spawn(traits.Sphere({ r: 200 }), traits.WorldMatrix())

		const { unmount } = render(MockCanvas, {
			props: { child: Spheres },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		await flush()

		const [faces, edges] = constructedMeshes
		expect(faces.getVisibilityAt(0)).toBe(true)
		expect(edges.getVisibilityAt(0)).toBe(true)

		unmount()
		await flush()
	})

	it('hides Capsules body and head faces but keeps edges shown for a wireframe entity', async () => {
		const { default: Capsules } = await import('../Capsules.svelte')
		world.spawn(traits.Capsule({ r: 100, l: 400 }), traits.WorldMatrix(), traits.Wireframe())

		const { unmount } = render(MockCanvas, {
			props: { child: Capsules },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		await flush()

		const [bodyFaces, bodyEdges, headFaces, headEdges] = constructedMeshes
		expect(bodyFaces.getVisibilityAt(0)).toBe(false)
		expect(bodyEdges.getVisibilityAt(0)).toBe(true)
		expect(headFaces.getVisibilityAt(0)).toBe(false)
		expect(headEdges.getVisibilityAt(0)).toBe(true)

		unmount()
		await flush()
	})

	it('shows both Capsules body/head faces and edges for a non-wireframe entity', async () => {
		const { default: Capsules } = await import('../Capsules.svelte')
		world.spawn(traits.Capsule({ r: 100, l: 400 }), traits.WorldMatrix())

		const { unmount } = render(MockCanvas, {
			props: { child: Capsules },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		await flush()

		const [bodyFaces, bodyEdges, headFaces, headEdges] = constructedMeshes
		expect(bodyFaces.getVisibilityAt(0)).toBe(true)
		expect(bodyEdges.getVisibilityAt(0)).toBe(true)
		expect(headFaces.getVisibilityAt(0)).toBe(true)
		expect(headEdges.getVisibilityAt(0)).toBe(true)

		unmount()
		await flush()
	})

	it('hides Cylinders faces but keeps edges shown for a wireframe entity', async () => {
		const { default: Cylinders } = await import('../Cylinders.svelte')
		world.spawn(
			traits.Cylinder({ r: 200, l: 400, capped: true }),
			traits.WorldMatrix(),
			traits.Wireframe()
		)

		const { unmount } = render(MockCanvas, {
			props: { child: Cylinders },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		await flush()

		const [faces, edges] = constructedMeshes
		expect(faces.getVisibilityAt(0)).toBe(false)
		expect(edges.getVisibilityAt(0)).toBe(true)

		unmount()
		await flush()
	})

	it('shows both Cylinders faces and edges for a non-wireframe entity', async () => {
		const { default: Cylinders } = await import('../Cylinders.svelte')
		world.spawn(traits.Cylinder({ r: 200, l: 400, capped: true }), traits.WorldMatrix())

		const { unmount } = render(MockCanvas, {
			props: { child: Cylinders },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		await flush()

		const [faces, edges] = constructedMeshes
		expect(faces.getVisibilityAt(0)).toBe(true)
		expect(edges.getVisibilityAt(0)).toBe(true)

		unmount()
		await flush()
	})
})

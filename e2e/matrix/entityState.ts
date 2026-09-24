import type { Page } from '@playwright/test'

/**
 * The `Object3D` a per-entity renderer mounts. Absent for the instanced types,
 * whose boxes, spheres, and capsules live in shared GPU buffers with no object
 * of their own.
 */
export interface Object3DState {
	/**
	 * Effective visibility, not the object's own flag. `Mesh.svelte` puts
	 * `visible` on a wrapping group and the entity name on the child inside it,
	 * so the named object stays visible while nothing of it renders.
	 */
	visible: boolean
	worldPosition: number[]
}

/**
 * Everything `draw.ts` writes for one entity, flattened to JSON so it can cross
 * the CDP boundary. A trait the entity does not carry reads as `undefined`,
 * which is what a case asserts against when it expects one to be retired.
 */
export interface EntityState {
	present: boolean
	/** World-space translation in metres, parent chain composed. */
	worldPosition?: number[]
	/** `Matrix` elements, column-major, as Three stores them. */
	localMatrix?: number[]
	parent?: string
	/** Set while the named parent has not appeared in the world yet. */
	orphan?: string
	center?: { x: number; y: number; z: number }
	color?: { r: number; g: number; b: number }
	colors?: number[]
	opacity?: number
	opacities?: number[]
	invisible: boolean
	inheritedInvisible: boolean
	axesHelper: boolean
	pointSize?: number
	lineWidth?: number
	dotSize?: number
	dotColors?: number[]
	object3d?: Object3DState
}

/**
 * A `toMatchObject` target: any subset of the state, and `object3d` may itself
 * be partial so a cell can assert one rendered field without the rest.
 */
export type ExpectedEntityState = Partial<Omit<EntityState, 'object3d'>> & {
	object3d?: Partial<Object3DState>
}

/**
 * The debug handles `useWorld` and `Scene.svelte` hang off `globalThis`. Typed
 * structurally rather than by importing koota and three, because these
 * annotations are erased before the function reaches the browser and importing
 * the real types would pull a bundler's worth of modules into the test process.
 */
interface PageEntity {
	get: (trait: unknown) => unknown
	has: (trait: unknown) => boolean
	isAlive: () => boolean
	targetFor: (relation: unknown) => PageEntity | undefined
}

interface PageObject3D {
	name: unknown
	visible: boolean
	parent: PageObject3D | null
	matrixWorld: { elements: number[] }
}

interface PageGlobals {
	__koota__?: {
		world: { query: (...traits: unknown[]) => Iterable<PageEntity> }
		traits: Record<string, unknown>
		relations: Record<string, unknown>
	}
	__threlte__?: { scene: { traverse: (visit: (object: PageObject3D) => void) => void } }
}

/**
 * Reads one entity's trait state out of the running page.
 *
 * Resolved inside a single `page.evaluate` and returned as plain JSON: koota
 * entities, `Matrix4`s, and typed arrays cannot cross CDP, and returning
 * handles instead would keep browser objects alive across the poll loop every
 * caller wraps this in.
 */
export const readEntityState = (page: Page, name: string): Promise<EntityState> =>
	page.evaluate((entityName): EntityState => {
		const koota = (globalThis as PageGlobals).__koota__
		if (!koota) throw new Error('__koota__ is not on the page yet')

		const { world, traits, relations } = koota

		// Rounded because a float that survived a mm -> m conversion and a matrix
		// compose lands a few ULPs from the value the test computed. -0 folds into
		// 0, which toMatchObject treats as a different number and a reader does not.
		const round = (value: number) => Math.round(value * 1e6) / 1e6 || 0
		const bytes = (value: unknown) => (value instanceof Uint8Array ? [...value] : undefined)
		const translation = (value: unknown) => {
			if (!value || typeof value !== 'object' || !('elements' in value)) return undefined
			const { elements } = value as { elements: number[] }
			return [round(elements[12]), round(elements[13]), round(elements[14])]
		}

		let match: PageEntity | undefined
		let entityId: number | undefined
		for (const entity of world.query(traits.Name)) {
			if (entity.get(traits.Name) !== entityName) continue
			match = entity
			entityId = entity as unknown as number
			break
		}

		const empty: EntityState = {
			present: false,
			invisible: false,
			inheritedInvisible: false,
			axesHelper: false,
		}
		if (!match || entityId === undefined) return empty

		// hierarchy.getParentName is not reachable from the page, so its two steps
		// run inline: a resolved ChildOf target first, the pending Orphan second.
		const parentEntity = match.targetFor(relations.ChildOf)
		const orphan = (match.get(traits.Orphan) as string) || undefined
		const parent =
			parentEntity && parentEntity.isAlive() ? (parentEntity.get(traits.Name) as string) : orphan

		const rendered = (object: PageObject3D) => {
			for (let node: PageObject3D | null = object; node; node = node.parent) {
				if (!node.visible) return false
			}
			return true
		}

		// Renderers set `name={entity}`, the koota entity id, not the display name.
		// Compared as strings because Three types `name` as one and the prop
		// assigns a number.
		let object3d: Object3DState | undefined
		const wanted = String(entityId)
		;(globalThis as PageGlobals).__threlte__?.scene.traverse((object) => {
			if (object3d || String(object.name) !== wanted) return
			object3d = {
				visible: rendered(object),
				worldPosition: translation(object.matrixWorld) ?? [],
			}
		})

		const center = match.get(traits.Center) as { x: number; y: number; z: number } | undefined
		const color = match.get(traits.Color) as { r: number; g: number; b: number } | undefined
		const opacity = match.get(traits.Opacity) as number | undefined
		const localMatrix = match.get(traits.Matrix) as { elements: number[] } | undefined

		return {
			present: true,
			worldPosition: translation(match.get(traits.WorldMatrix)),
			localMatrix: localMatrix ? [...localMatrix.elements].map((value) => round(value)) : undefined,
			parent,
			orphan,
			center: center && { x: round(center.x), y: round(center.y), z: round(center.z) },
			color: color && { r: round(color.r), g: round(color.g), b: round(color.b) },
			colors: bytes(match.get(traits.Colors)),
			opacity: opacity === undefined ? undefined : round(opacity),
			opacities: bytes(match.get(traits.Opacities)),
			invisible: match.has(traits.Invisible),
			inheritedInvisible: match.has(traits.InheritedInvisible),
			axesHelper: match.has(traits.ShowAxesHelper),
			pointSize: match.get(traits.PointSize) as number | undefined,
			lineWidth: match.get(traits.LineWidth) as number | undefined,
			dotSize: match.get(traits.DotSize) as number | undefined,
			dotColors: bytes(match.get(traits.DotColors)),
			object3d,
		}
	}, name)

/** Every entity name the draw service put in the scene, sorted. */
export const readSceneNames = (page: Page): Promise<string[]> =>
	page.evaluate(() => {
		const koota = (globalThis as PageGlobals).__koota__
		if (!koota) throw new Error('__koota__ is not on the page yet')

		const { world, traits } = koota
		const names: string[] = []
		for (const entity of world.query(traits.Name, traits.DrawAPI)) {
			names.push(entity.get(traits.Name) as string)
		}
		return names.toSorted()
	})

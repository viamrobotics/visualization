import type { Entity, World } from 'koota'

import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { get, set } from 'idb-keyval'
import { tick } from 'svelte'
import {
	BufferGeometry,
	type Camera,
	Color,
	Float32BufferAttribute,
	type Material,
	Matrix4,
	Raycaster,
	Vector3,
	Vector4,
} from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventBus } from '#lib/hooks/useEventBus.js'
import type { useSettings } from '#lib/hooks/useSettings.svelte.js'
import type { ShapeBatches, ShapeInstanceIds } from '#lib/three/shapeBatches.js'

import {
	dimColor,
	relations,
	resolveOpacity,
	traits,
	TRANSLUCENT_GEOMETRY_OPACITY,
} from '#lib/ecs/index.js'

import BareScopedSceneHost from './__fixtures__/BareScopedSceneHost.svelte'
import { robotQueryParts } from './__fixtures__/robotQueryParts'
import ScopedSceneHost from './__fixtures__/ScopedSceneHost.svelte'

vi.mock('@threlte/core/webgpu', (importOriginal) => importOriginal())
vi.mock('@threlte/extras/webgpu', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useFrames.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useConfigFrames.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useResourceByName.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useFragmentInfo.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/usePartConfig.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useLinked.svelte.js', (importOriginal) => importOriginal())
vi.mock('@viamrobotics/svelte-sdk', async (importOriginal) => {
	const { recordRobotQueryParts } = await import('./__fixtures__/robotQueryParts')
	return recordRobotQueryParts(await importOriginal())
})

/** The shape batches the scene's renderers draw into, and the instance each entity was given there. */
const SCENE_READY_TIMEOUT_MS = 10_000

const renderedShapes = vi.hoisted(() => ({
	batches: undefined as ShapeBatches | undefined,
	handles: new Map<Entity, ShapeInstanceIds>(),
}))

vi.mock('#lib/components/Entities/useShapeBatches.js', async (importOriginal) => {
	const original =
		await importOriginal<typeof import('#lib/components/Entities/useShapeBatches.js')>()

	return {
		...original,
		provideShapeBatches: (batches: ShapeBatches) => {
			const context = original.provideShapeBatches(batches)
			renderedShapes.batches = batches
			renderedShapes.handles.clear()

			const { add, addMesh, release } = context
			context.add = (entity, shape) => {
				const ids = add(entity, shape)
				renderedShapes.handles.set(entity, ids)
				return ids
			}
			context.addMesh = (entity, slot) => {
				const ids = addMesh(entity, slot)
				renderedShapes.handles.set(entity, ids)
				return ids
			}
			context.release = (ids) => {
				for (const [entity, handle] of renderedShapes.handles) {
					if (handle === ids) renderedShapes.handles.delete(entity)
				}
				release(ids)
			}

			return context
		},
	}
})
vi.mock('idb-keyval', () => ({
	get: vi.fn(() => Promise.resolve(undefined)),
	set: vi.fn(() => Promise.resolve()),
}))

interface Probe {
	world: World
	settings: ReturnType<typeof useSettings>
	camera: () => Camera
	bus: EventBus
	isSceneBus: boolean
}

type HostProps = Omit<Parameters<typeof ScopedSceneHost>[1], 'onready'>

const renderHost = async (props: HostProps = {}) => {
	const probes = new Map<number, Probe>()
	const result = render(ScopedSceneHost, {
		...props,
		onready: (index, probe) => {
			probes.set(index, probe)
		},
	})

	const sceneCount = props.sceneCount ?? 1
	await expect
		.poll(() => result.container.querySelectorAll('canvas').length, {
			timeout: SCENE_READY_TIMEOUT_MS,
		})
		.toBe(sceneCount)
	await expect.poll(() => probes.size, { timeout: SCENE_READY_TIMEOUT_MS }).toBe(sceneCount)

	return { ...result, probes }
}

const firstProbe = (probes: Map<number, Probe>): Probe => {
	const probe = probes.get(0)
	if (!probe) throw new Error('the scene probe never reported')
	return probe
}

const CONTAINER_WIDTH_PX = 672
const CONTAINER_HEIGHT_PX = 504

const POINT_CLOUD_OPACITY = 0.8

const ARM_1_COLOR = { r: 0.8, g: 0.2, b: 0.1 }
const ARM_2_COLOR = { r: 0.1, g: 0.3, b: 0.8 }
const GRIPPER_COLOR = { r: 0.9, g: 0.7, b: 0.1 }
const OBSTACLE_COLOR = { r: 0.2, g: 0.7, b: 0.3 }

const ARM_2_ORIGIN = new Vector3(-1, 0, 0)
const OBSTACLE_AWAY_FROM_ARMS = new Vector3(0, 1, 0)

/** Every collidable geometry the staged machine has, with the color it was spawned in. */
const COLLIDABLE_COLORS = {
	'arm-1:base': ARM_1_COLOR,
	'arm-1:upper': ARM_1_COLOR,
	gripper: GRIPPER_COLOR,
	'arm-2:base': ARM_2_COLOR,
	'arm-2:upper': ARM_2_COLOR,
	obstacle: OBSTACLE_COLOR,
} as const

type CollidableName = keyof typeof COLLIDABLE_COLORS

const COLLIDABLE_NAMES = Object.keys(COLLIDABLE_COLORS) as CollidableName[]
const ARM_1_CHAIN: CollidableName[] = ['arm-1:base', 'arm-1:upper', 'gripper']
const ARM_2_CHAIN: CollidableName[] = ['arm-2:base', 'arm-2:upper']

const translation = (position: Vector3) =>
	new Matrix4().makeTranslation(position.x, position.y, position.z)

/** A frame as the frame loaders spawn it, with an optional box geometry and source opacity. */
const spawnFrame = (
	world: World,
	name: string,
	{
		parent,
		position = new Vector3(),
		color,
		opacity,
	}: {
		parent?: Entity
		position?: Vector3
		color?: { r: number; g: number; b: number }
		opacity?: number
	}
): Entity =>
	world.spawn(
		traits.Name(name),
		traits.FramesAPI,
		traits.Matrix(translation(position)),
		...(parent ? [relations.ChildOf(parent)] : []),
		...(color ? [traits.Color(color), traits.Box({ x: 200, y: 200, z: 200 })] : []),
		...(opacity === undefined ? [] : [traits.Opacity(opacity)])
	)

const spawnArm = (
	world: World,
	name: string,
	origin: Vector3,
	color: { r: number; g: number; b: number },
	opacity?: number
) => {
	const arm = spawnFrame(world, name, { position: origin })
	const base = spawnFrame(world, `${name}:base`, { parent: arm, color, opacity })
	const upper = spawnFrame(world, `${name}:upper`, {
		parent: base,
		position: new Vector3(0, 0, 0.3),
		color,
		opacity,
	})
	return { arm, base, upper }
}

/** Two arms whose link colliders carry the frame loaders' `TRANSLUCENT_GEOMETRY_OPACITY`, and an obstacle with no opacity of its own. */
const stageTranslucentColliders = (world: World) => {
	spawnArm(world, 'arm-1', new Vector3(), ARM_1_COLOR, TRANSLUCENT_GEOMETRY_OPACITY)
	spawnArm(world, 'arm-2', ARM_2_ORIGIN, ARM_2_COLOR, TRANSLUCENT_GEOMETRY_OPACITY)
	spawnFrame(world, 'obstacle', { position: OBSTACLE_AWAY_FROM_ARMS, color: OBSTACLE_COLOR })
}

/** Two arms, a gripper on the first arm's last link, an obstacle, and a point cloud. */
const stageMachine = (world: World, obstaclePosition = OBSTACLE_AWAY_FROM_ARMS) => {
	const arm1 = spawnArm(world, 'arm-1', new Vector3(), ARM_1_COLOR)
	spawnFrame(world, 'gripper', {
		parent: arm1.upper,
		position: new Vector3(0, 0, 0.3),
		color: GRIPPER_COLOR,
	})
	spawnArm(world, 'arm-2', ARM_2_ORIGIN, ARM_2_COLOR)
	spawnFrame(world, 'obstacle', { position: obstaclePosition, color: OBSTACLE_COLOR })

	const cloud = new BufferGeometry()
	cloud.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0], 3))
	world.spawn(
		traits.Name('point-cloud'),
		traits.Points,
		traits.BufferGeometry(cloud),
		traits.Opacity(POINT_CLOUD_OPACITY)
	)
}

const byName = (world: World, name: string): Entity => {
	const entity = world.query(traits.Name).find((candidate) => candidate.get(traits.Name) === name)
	if (!entity) throw new Error(`no entity named ${name}`)
	return entity
}

interface RenderedShape {
	pass: ShapeInstanceIds['pass']
	isVisible: boolean
	opacity: number
	colorHex: number
}

/** What the shape batches hold for the entity: its pass, visibility, and instance color and alpha. */
const renderedShape = (entity: Entity): RenderedShape | undefined => {
	const handle = renderedShapes.handles.get(entity)
	const batches = renderedShapes.batches
	if (!handle || !batches) return undefined

	const { faces } = batches[handle.pass]
	const rgba = new Vector4()
	faces.getColorAt(handle.face, rgba)

	return {
		pass: handle.pass,
		isVisible: faces.getVisibleAt(handle.face),
		opacity: rgba.w,
		colorHex: new Color(rgba.x, rgba.y, rgba.z).getHex(),
	}
}

const renderedOpacities = (world: World): Record<CollidableName, number | undefined> =>
	Object.fromEntries(
		COLLIDABLE_NAMES.map((name) => [name, renderedShape(byName(world, name))?.opacity])
	) as Record<CollidableName, number | undefined>

/** The opacity each collidable should render at when `focused` is in focus and the rest are dimmed. */
const expectedOpacities = (
	focused: readonly CollidableName[] | 'everything'
): Record<CollidableName, number> =>
	Object.fromEntries(
		COLLIDABLE_NAMES.map((name) => [
			name,
			focused === 'everything' || focused.includes(name) ? 1 : 0.5,
		])
	) as Record<CollidableName, number>

const colorHex = ({ r, g, b }: { r: number; g: number; b: number }, isDimmed: boolean) => {
	const color = new Color(r, g, b)
	return (isDimmed ? dimColor(color) : color).getHex()
}

/** Asserts every collidable is drawn, in its own color when focused and muted otherwise. */
const expectRenderedFocus = (world: World, focused: readonly CollidableName[] | 'everything') => {
	for (const name of COLLIDABLE_NAMES) {
		const isFocused = focused === 'everything' || focused.includes(name)
		expect(renderedShape(byName(world, name)), name).toEqual({
			pass: isFocused ? 'opaque' : 'translucent',
			isVisible: true,
			opacity: isFocused ? 1 : 0.5,
			colorHex: colorHex(COLLIDABLE_COLORS[name], !isFocused),
		})
	}
}

describe('ScopedScene', () => {
	beforeEach(() => {
		robotQueryParts.length = 0
	})

	it('renders a canvas and none of the Dashboard, Workspace, or Controls overlays', async () => {
		const { container } = await renderHost()

		expect(container.querySelector('canvas')).not.toBeNull()
		expect(container.querySelector('.top-2.w-full.justify-center')).toBeNull()
		expect(container.querySelector('.top-2.right-2.z-4')).toBeNull()
		expect(screen.queryByRole('button', { name: 'Reset camera' })).toBeNull()
	})

	it('ignores h and Escape on a selection while input bindings are off', async () => {
		const { probes } = await renderHost()
		const { world } = firstProbe(probes)
		const entity = world.spawn(traits.Name('selected'), traits.Selected)
		await tick()

		const user = userEvent.setup()
		await user.keyboard('h')
		await user.keyboard('{Escape}')

		expect(entity.has(traits.Invisible)).toBe(false)
		expect(entity.has(traits.Selected)).toBe(true)
	})

	it('hides the selection on h once input bindings are turned on', async () => {
		const { probes, rerender } = await renderHost()
		const { world } = firstProbe(probes)
		const entity = world.spawn(traits.Name('selected'), traits.Selected)
		await rerender({ inputBindingsEnabled: true })

		const user = userEvent.setup()
		await user.keyboard('h')

		expect(entity.has(traits.Invisible)).toBe(true)
	})

	it('applies settings props without reading or writing IndexedDB', async () => {
		const { probes, rerender } = await renderHost()
		const { settings } = firstProbe(probes)
		await rerender({ snapping: true, poseRefreshRate: 250 })

		await expect.poll(() => settings.current.snapping).toBe(true)
		expect(settings.current.refreshRates.poses).toBe(250)
		await tick()

		expect(get).not.toHaveBeenCalled()
		expect(set).not.toHaveBeenCalled()
	})

	it('gives each of two scenes on one page its own world', async () => {
		const { probes } = await renderHost({ sceneCount: 2 })
		const first = probes.get(0)?.world
		const second = probes.get(1)?.world

		expect(first).toBeDefined()
		expect(second).toBeDefined()
		expect(first).not.toBe(second)

		const entity = first?.spawn(traits.Name('only-in-first'), traits.Selected)

		expect(entity && first?.has(entity)).toBe(true)
		expect(entity && second?.has(entity)).toBe(false)
		expect(second?.query(traits.Selected)).toHaveLength(0)
	})

	it('provides the scene an event bus of its own, the one its diagnostic writers publish to', async () => {
		const { probes } = await renderHost()

		expect(firstProbe(probes).isSceneBus).toBe(true)
	})

	it('gives each of two scenes on one page its own event bus', async () => {
		const { probes } = await renderHost({ sceneCount: 2 })
		const first = probes.get(0)?.bus
		const second = probes.get(1)?.bus
		const heardByFirst = vi.fn()
		const heardBySecond = vi.fn()
		first?.subscribe('diagnostic', heardByFirst)
		second?.subscribe('diagnostic', heardBySecond)

		first?.publish('diagnostic', { message: 'only in the first scene', level: 'error' })

		expect(heardByFirst).toHaveBeenCalledTimes(1)
		expect(heardBySecond).not.toHaveBeenCalled()
	})

	it('drops a diagnostic published with no Logs plugin mounted', async () => {
		const { probes } = await renderHost()
		const { bus } = firstProbe(probes)

		expect(() =>
			bus.publish('diagnostic', { message: 'nobody listens', level: 'error' })
		).not.toThrow()
	})

	it('mounts its scene children under nothing but the Viam provider without an uncaught error', async () => {
		const uncaught: string[] = []
		const recordUncaught = (event: ErrorEvent) => uncaught.push(event.message)
		window.addEventListener('error', recordUncaught)

		const { probes } = await renderHost()
		window.removeEventListener('error', recordUncaught)

		expect(probes.has(0), 'the scene child mounted and reported').toBe(true)
		expect(uncaught).toEqual([])
	})

	it('renders its children with every robot query addressed to no part when mounted without a part ID', async () => {
		const { container, probes } = await renderHost({ withoutPartID: true })

		expect(container.querySelector('canvas')).not.toBeNull()
		expect(probes.has(0), 'the scene child mounted and reported').toBe(true)
		expect(new Set(robotQueryParts)).toEqual(new Set(['']))
	})

	it('fails to mount its scene children with no Viam provider in the tree', async () => {
		const errors: unknown[] = []
		let isChildMounted = false

		render(BareScopedSceneHost, {
			onready: () => {
				isChildMounted = true
			},
			onerror: (error) => errors.push(error),
		})

		await expect
			.poll(() => errors.map(String))
			.toEqual([expect.stringContaining('No QueryClient was found in Svelte context')])
		expect(isChildMounted, 'the scene child mounted without a provider').toBe(false)
	})

	describe('frame focus', () => {
		it('renders the focused arm opaque and the other arm and the obstacle de-emphasized', async () => {
			const { probes } = await renderHost({ frame: 'arm-1' })
			const { world } = firstProbe(probes)
			stageMachine(world)

			await expect
				.poll(() => renderedOpacities(world))
				.toEqual(expectedOpacities(['arm-1:base', 'arm-1:upper', 'gripper']))
			expectRenderedFocus(world, ARM_1_CHAIN)

			const pointCloud = byName(world, 'point-cloud')
			expect(pointCloud.has(traits.Dimmed)).toBe(false)
			expect(resolveOpacity(pointCloud)).toBe(POINT_CLOUD_OPACITY)
		})

		it('halves the alpha of translucent colliders outside the focus, below the focused arm', async () => {
			const { probes } = await renderHost({ frame: 'arm-1' })
			const { world } = firstProbe(probes)
			stageTranslucentColliders(world)

			const rendered = (name: string) => renderedShape(byName(world, name))
			await expect.poll(() => rendered('arm-2:upper')?.opacity).toBe(0.25)

			expect({
				'arm-1:base': rendered('arm-1:base'),
				'arm-1:upper': rendered('arm-1:upper'),
				'arm-2:base': rendered('arm-2:base'),
				'arm-2:upper': rendered('arm-2:upper'),
				obstacle: rendered('obstacle'),
			}).toEqual({
				'arm-1:base': { pass: 'translucent', isVisible: true, opacity: 0.5, colorHex: 0xe7_7c_59 },
				'arm-1:upper': { pass: 'translucent', isVisible: true, opacity: 0.5, colorHex: 0xe7_7c_59 },
				'arm-2:base': { pass: 'translucent', isVisible: true, opacity: 0.25, colorHex: 0x9b_b0_da },
				'arm-2:upper': {
					pass: 'translucent',
					isVisible: true,
					opacity: 0.25,
					colorHex: 0x9b_b0_da,
				},
				obstacle: { pass: 'translucent', isVisible: true, opacity: 0.5, colorHex: 0xa6_d0_b3 },
			})
		})

		it('swaps focus to the other arm when the frame changes', async () => {
			const { probes, rerender } = await renderHost({ frame: 'arm-1' })
			const { world } = firstProbe(probes)
			stageMachine(world)
			await expect.poll(() => renderedOpacities(world)).toEqual(expectedOpacities(ARM_1_CHAIN))

			await rerender({ frame: 'arm-2' })

			await expect.poll(() => renderedOpacities(world)).toEqual(expectedOpacities(ARM_2_CHAIN))
			expectRenderedFocus(world, ARM_2_CHAIN)
		})

		it('renders everything at full opacity once the frame is cleared', async () => {
			const { probes, rerender } = await renderHost({ frame: 'arm-1' })
			const { world } = firstProbe(probes)
			stageMachine(world)
			await expect.poll(() => renderedOpacities(world)).toEqual(expectedOpacities(ARM_1_CHAIN))

			await rerender({ frame: undefined })

			await expect.poll(() => renderedOpacities(world)).toEqual(expectedOpacities('everything'))
			expectRenderedFocus(world, 'everything')
		})

		it('keeps every link and the mounted gripper opaque for the bare arm name', async () => {
			const { probes } = await renderHost({ frame: 'arm-1' })
			const { world } = firstProbe(probes)
			stageMachine(world)

			await expect.poll(() => renderedOpacities(world)).toEqual(expectedOpacities(ARM_1_CHAIN))
			expect(byName(world, 'arm-1').has(traits.Box)).toBe(false)
			for (const name of ARM_1_CHAIN) {
				expect(renderedShape(byName(world, name))?.pass, name).toBe('opaque')
			}
		})

		it('draws a dimmed obstacle in front of the focused arm without depth, after the arm', async () => {
			const { probes } = await renderHost({ frame: 'arm-1' })
			const { world, camera } = firstProbe(probes)
			const cameraPosition = camera().getWorldPosition(new Vector3())
			const armBaseCenter = new Vector3()
			stageMachine(world, cameraPosition.clone().lerp(armBaseCenter, 0.5))

			const obstacle = byName(world, 'obstacle')
			const armBase = byName(world, 'arm-1:base')
			await expect.poll(() => renderedShape(obstacle)?.pass).toBe('translucent')
			await expect.poll(() => renderedShape(armBase)?.pass).toBe('opaque')

			const batches = renderedShapes.batches
			if (!batches) throw new Error('the scene never provided its shape batches')
			const translucentMaterial = batches.translucent.faces.material as Material
			const opaqueMaterial = batches.opaque.faces.material as Material
			expect(translucentMaterial.transparent).toBe(true)
			expect(translucentMaterial.depthWrite).toBe(false)
			expect(opaqueMaterial.transparent).toBe(false)

			const towardArm = armBaseCenter.clone().sub(camera().getWorldPosition(new Vector3()))
			const raycaster = new Raycaster(
				camera().getWorldPosition(new Vector3()),
				towardArm.normalize()
			)
			const hits = raycaster
				.intersectObjects([batches.opaque.faces, batches.translucent.faces], false)
				.map((hit) => ({ object: hit.object, batchId: hit.batchId }))

			expect(hits[0], 'the obstacle is the nearest thing on the line of sight').toEqual({
				object: batches.translucent.faces,
				batchId: renderedShapes.handles.get(obstacle)?.face,
			})
			expect(hits).toContainEqual({
				object: batches.opaque.faces,
				batchId: renderedShapes.handles.get(armBase)?.face,
			})
		})

		it('fills a 672 by 504 px container with its canvas', async () => {
			const { container } = await renderHost({ frame: 'arm-1' })
			const canvas = container.querySelector('canvas')
			if (!canvas) throw new Error('the scene rendered no canvas')

			await expect
				.poll(() => [canvas.clientWidth, canvas.clientHeight])
				.toEqual([CONTAINER_WIDTH_PX, CONTAINER_HEIGHT_PX])
			const rect = canvas.getBoundingClientRect()
			expect([rect.width, rect.height]).toEqual([CONTAINER_WIDTH_PX, CONTAINER_HEIGHT_PX])
		})
	})
})

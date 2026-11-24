import type { World } from 'koota'
import type { Camera } from 'three'

import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { get, set } from 'idb-keyval'
import { tick } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventBus } from '#lib/hooks/useEventBus.js'
import type { useSettings } from '#lib/hooks/useSettings.svelte.js'

import { traits } from '#lib/ecs/index.js'

import BareSceneViewHost from './__fixtures__/BareSceneViewHost.svelte'
import { robotQueryParts } from './__fixtures__/robotQueryParts'
import SceneViewHost from './__fixtures__/SceneViewHost.svelte'

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

const SCENE_READY_TIMEOUT_MS = 10_000

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

type HostProps = Omit<Parameters<typeof SceneViewHost>[1], 'onready'>

const renderHost = async (props: HostProps = {}) => {
	const probes = new Map<number, Probe>()
	const result = render(SceneViewHost, {
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

describe('SceneView', () => {
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

		render(BareSceneViewHost, {
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

	it('fills a 672 by 504 px container with its canvas', async () => {
		const { container } = await renderHost()
		const canvas = container.querySelector('canvas')
		if (!canvas) throw new Error('the scene rendered no canvas')

		await expect
			.poll(() => [canvas.clientWidth, canvas.clientHeight])
			.toEqual([CONTAINER_WIDTH_PX, CONTAINER_HEIGHT_PX])
		const rect = canvas.getBoundingClientRect()
		expect([rect.width, rect.height]).toEqual([CONTAINER_WIDTH_PX, CONTAINER_HEIGHT_PX])
	})
})

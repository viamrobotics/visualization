import { describe, expect, it } from 'vitest'

import type { FrameDelta } from '../frameDeltaAdapter'
import type { ComponentFrameInfo } from '../useSceneBuilder.svelte'

import {
	ComponentFrameInfoSchema,
	FrameDeltaSchema,
	SceneBuilderResponseSchema,
} from '../inferContract'

/**
 * The wire schemas are defined independently of the plugin's own types so the contract stays
 * importable from a server handler. These assert the two descriptions of the same payload have
 * not drifted apart.
 */
describe('inferContract', () => {
	it('accepts a ComponentFrameInfo as the plugin builds it', () => {
		const component = {
			name: 'arm-1',
			frame: {
				parent: 'world',
				translation: { x: 100, y: 0, z: 250 },
				orientation: { roll: 0, pitch: 0, yaw: 45 },
				geometry: { type: 'box', x: 10, y: 20, z: 30 },
			},
		} satisfies ComponentFrameInfo

		expect(ComponentFrameInfoSchema.parse(component)).toEqual(component)
	})

	it('accepts a component with no geometry', () => {
		const component = {
			name: 'sensor',
			frame: {
				parent: 'arm-1',
				translation: { x: 0, y: 0, z: 0 },
				orientation: { roll: 0, pitch: 0, yaw: 0 },
			},
		} satisfies ComponentFrameInfo

		expect(ComponentFrameInfoSchema.parse(component)).toEqual(component)
	})

	it('parses a delta into the shape the diff step consumes', () => {
		const delta = {
			componentName: 'arm-1',
			translation: { x: 200 },
			orientation: { yaw: 135 },
			geometry: { type: 'sphere', r: 50 },
			parent: 'world',
			explanation: 'move forward and re-parent',
		}

		// Assignable to FrameDelta means the plugin can consume what the schema produces.
		const parsed: FrameDelta = FrameDeltaSchema.parse(delta)
		expect(parsed).toEqual(delta)
	})

	it.each([
		['a bare resize with no type', { componentName: 'a', geometry: { r: 5 } }],
		['geometry removal', { componentName: 'a', geometry: { type: 'none' } }],
		['a translation-only delta', { componentName: 'a', translation: { z: -10 } }],
	])('accepts %s', (_label, delta) => {
		expect(() => FrameDeltaSchema.parse(delta)).not.toThrow()
	})

	it.each([
		['a yaw beyond 180', { componentName: 'a', orientation: { yaw: 181 } }],
		['a non-positive dimension', { componentName: 'a', geometry: { r: 0 } }],
		['a null geometry', { componentName: 'a', geometry: null }],
		['a missing componentName', { translation: { x: 1 } }],
	])('rejects %s', (_label, delta) => {
		expect(() => FrameDeltaSchema.parse(delta)).toThrow()
	})

	it('treats a refusal with no updates as valid', () => {
		const response = { updates: [], refusal: 'I cannot add components at the moment.' }
		expect(SceneBuilderResponseSchema.parse(response)).toEqual(response)
	})
})

import { describe, expect, it } from 'vitest'

import { isSceneBehindConfig, type SceneRevisions } from '../isSceneBehindConfig'

const revisions = (overrides: Partial<SceneRevisions> = {}): SceneRevisions => ({
	isBuildMode: false,
	renderedRevision: 'rev-1',
	machineRevision: 'rev-1',
	...overrides,
})

describe('isSceneBehindConfig', () => {
	it('is false while the scene and the machine agree on a revision', () => {
		expect(isSceneBehindConfig(revisions())).toBe(false)
	})

	it('is true once the machine moves to a revision the frames were not fetched under', () => {
		expect(isSceneBehindConfig(revisions({ machineRevision: 'rev-2' }))).toBe(true)
	})

	it('is false in build mode, where the scene draws the saved config directly', () => {
		const behind = revisions({ isBuildMode: true, machineRevision: 'rev-2' })

		expect(isSceneBehindConfig(behind)).toBe(false)
	})

	it('is false before the first frames reply', () => {
		const noFrames = revisions({ renderedRevision: '', machineRevision: 'rev-2' })

		expect(isSceneBehindConfig(noFrames)).toBe(false)
	})

	it('is false when the machine reports no revision to compare against', () => {
		const noRevision = revisions({ renderedRevision: 'rev-1', machineRevision: '' })

		expect(isSceneBehindConfig(noRevision)).toBe(false)
	})
})

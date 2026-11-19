import { describe, expect, it } from 'vitest'

import { liveFrameName, previewName, savedPoseName } from '../previewNames'

describe('liveFrameName', () => {
	it.each([
		{ ghost: previewName('arm:wrist_link'), live: 'arm:wrist_link' },
		{ ghost: savedPoseName('arm-pose-1', 'arm:wrist_link'), live: 'arm:wrist_link' },
		{ ghost: 'arm:wrist_link', live: 'arm:wrist_link' },
	])('reads $ghost back as $live', ({ ghost, live }) => {
		expect(liveFrameName(ghost)).toBe(live)
	})
})

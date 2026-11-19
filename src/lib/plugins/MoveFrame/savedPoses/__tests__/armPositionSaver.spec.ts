import { describe, expect, it } from 'vitest'

import { ARM_POSITION_SAVER_MODEL, parseArmPositionSaver } from '../armPositionSaver'

const saver = (attributes: Record<string, unknown>) => ({
	name: 'arm-pose-1',
	model: ARM_POSITION_SAVER_MODEL,
	attributes: { arm: 'arm', ...attributes },
})

describe('parseArmPositionSaver', () => {
	it('reads the capitalized point keys the module writes from r3.Vector', () => {
		const parsed = parseArmPositionSaver(
			saver({
				point: { X: 100, Y: -20, Z: 300 },
				orientation: { x: 0, y: 0, z: -1, th: 90 },
			})
		)

		expect(parsed?.pose).toMatchObject({ x: 100, y: -20, z: 300, oZ: -1, theta: 90 })
	})

	it('prefers saved joints over a saved pose, as the module does on go-to', () => {
		const parsed = parseArmPositionSaver(saver({ joints: [0.1, 0.2], point: { X: 1, Y: 2, Z: 3 } }))

		expect(parsed).toEqual({
			name: 'arm-pose-1',
			arm: 'arm',
			motion: '',
			joints: [0.1, 0.2],
		})
	})

	it('ignores components of any other model', () => {
		expect(
			parseArmPositionSaver({ ...saver({ joints: [0] }), model: 'erh:vmodutils:obstacle' })
		).toBeUndefined()
	})
})

import { describe, expect, it } from 'vitest'

import { commonFolderName } from '../commonFolderName'

const file = (name: string) => ({ name, bytes: new Uint8Array() })

describe('commonFolderName', () => {
	it('names the folder every file shares', () => {
		expect(commonFolderName([file('gripper/a.stl'), file('gripper/cad/b.stl')])).toBe('gripper')
	})

	it.each([
		{ label: 'loose files', files: [file('a.stl'), file('b.stl')] },
		{ label: 'different folders', files: [file('x/a.stl'), file('y/b.stl')] },
		{ label: 'a mix of folder and loose', files: [file('x/a.stl'), file('b.stl')] },
		{ label: 'no files', files: [] },
	])('is undefined for $label', ({ files }) => {
		expect(commonFolderName(files)).toBeUndefined()
	})
})

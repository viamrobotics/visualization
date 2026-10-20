import { describe, expect, it } from 'vitest'

import { projectFromFiles } from '../projectFromFiles'

const encoder = new TextEncoder()

const specFile = (name: string, ...paths: string[]) => ({
	name,
	bytes: encoder.encode(
		JSON.stringify({
			name: 'tool',
			links: paths.map((meshPath, index) => ({ id: `l${index}`, meshPath })),
		})
	),
})
const file = (name: string) => ({ name, bytes: new Uint8Array([1]) })

describe('projectFromFiles', () => {
	it.each([
		{
			label: 'a root spec with its files',
			files: [specFile('kinematics.json', 'a.stl'), file('a.stl')],
			sources: ['a.stl'],
			missing: [],
		},
		{
			label: 'a folder drop where the source is relative to the spec',
			files: [specFile('tool/kinematics.json', 'cad/a.stl'), file('tool/cad/a.stl')],
			sources: ['cad/a.stl'],
			missing: [],
		},
		{
			label: 'a unique basename when the path does not match',
			files: [specFile('kinematics.json', 'cad/a.stl'), file('elsewhere/deep/a.stl')],
			sources: ['cad/a.stl'],
			missing: [],
		},
		{
			label: 'an ambiguous basename listed as missing',
			files: [specFile('kinematics.json', 'cad/a.stl'), file('x/a.stl'), file('y/a.stl')],
			sources: [],
			missing: ['cad/a.stl'],
		},
		{
			label: 'sources with no file, sorted',
			files: [specFile('kinematics.json', 'z.stl', 'b.stl', 'a.stl'), file('a.stl')],
			sources: ['a.stl'],
			missing: ['b.stl', 'z.stl'],
		},
		{
			label: 'the shallowest spec when several are dropped',
			files: [
				specFile('deep/er/kinematics.json', 'wrong.stl'),
				specFile('tool/kinematics.json', 'a.stl'),
				file('tool/a.stl'),
			],
			sources: ['a.stl'],
			missing: [],
		},
	])('finds $label', ({ files, sources, missing }) => {
		const project = projectFromFiles(files)

		expect(project?.sources.map((source) => source.name)).toEqual(sources)
		expect(project?.missing).toEqual(missing)
	})

	it('returns undefined when no file is named kinematics.json', () => {
		expect(projectFromFiles([file('a.stl')])).toBeUndefined()
	})

	it('throws with the parse error as cause on malformed JSON', () => {
		const broken = { name: 'kinematics.json', bytes: encoder.encode('{nope') }

		let failure: unknown
		try {
			projectFromFiles([broken])
		} catch (error) {
			failure = error
		}

		expect(failure).toBeInstanceOf(Error)
		expect((failure as Error).cause).toBeInstanceOf(Error)
	})
})

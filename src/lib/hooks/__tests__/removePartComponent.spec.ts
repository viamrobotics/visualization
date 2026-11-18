import { describe, expect, it } from 'vitest'

import type { PartConfig } from '../usePartConfig.svelte'

import { removePartComponent } from '../removePartComponent'

const config = (): PartConfig => ({
	components: [{ name: 'arm' }, { name: 'arm-pose-1' }, { name: 'arm-pose-2' }],
	modules: [
		{ type: 'registry', name: 'erh_vmodutils', module_id: 'erh:vmodutils', version: 'latest' },
	],
})

describe('removePartComponent', () => {
	it('removes only the named component', () => {
		const edited = config()

		removePartComponent(edited, 'arm-pose-1')

		expect(edited.components.map(({ name }) => name)).toEqual(['arm', 'arm-pose-2'])
	})

	it('keeps the modules other components may still load from', () => {
		const edited = config()

		removePartComponent(edited, 'arm-pose-1')

		expect(edited.modules).toEqual(config().modules)
	})

	it('reports a name the config does not have, leaving it unchanged', () => {
		const edited = config()

		expect(removePartComponent(edited, 'missing')).toBe(false)
		expect(edited).toEqual(config())
	})
})

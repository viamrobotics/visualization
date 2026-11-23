import { render } from '@testing-library/svelte'
import { Struct } from '@viamrobotics/sdk'
import { describe, expect, it, vi } from 'vitest'

import type { PartConfigContext } from '#lib/hooks/usePartConfig.svelte.js'

import EmbeddedPartConfigHost from './__fixtures__/EmbeddedPartConfigHost.svelte'

vi.mock('#lib/hooks/usePartConfig.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useFragmentInfo.svelte.js', (importOriginal) => importOriginal())

const renderEmbedded = (componentNames: string[]) => {
	const setLocalPartConfig = vi.fn<(config: Struct) => void>()
	let partConfig: PartConfigContext | undefined

	render(EmbeddedPartConfigHost, {
		props: {
			current: Struct.fromJson({ components: componentNames.map((name) => ({ name })) }),
			setLocalPartConfig,
			onready: (context: PartConfigContext) => (partConfig = context),
		},
	})

	if (partConfig === undefined) throw new Error('The host never provided a part config.')
	return { partConfig, setLocalPartConfig }
}

const writtenNames = (config: Struct | undefined) =>
	(config?.toJson() as { components?: { name: string }[] } | undefined)?.components?.map(
		({ name }) => name
	)

describe('createComponents, with a host that has not passed the last write back', () => {
	it('lands every component in a single write', () => {
		const { partConfig, setLocalPartConfig } = renderEmbedded(['arm'])

		partConfig.createComponents([{ name: 'a' }, { name: 'b' }])

		expect(setLocalPartConfig).toHaveBeenCalledOnce()
		expect(writtenNames(setLocalPartConfig.mock.lastCall?.[0])).toEqual(['arm', 'a', 'b'])
	})

	it('leaves out a component whose name is already in the config', () => {
		const { partConfig, setLocalPartConfig } = renderEmbedded(['a'])

		partConfig.createComponents([{ name: 'a' }, { name: 'b' }])

		expect(writtenNames(setLocalPartConfig.mock.lastCall?.[0])).toEqual(['a', 'b'])
	})
})

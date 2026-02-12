import { relation } from 'koota'

export const SubEntityLinkType = {
	HoverLink: 'HoverLink',
} as const
export const SubEntityLink = relation({
	store: { indexMapping: () => 'index', type: '' },
})

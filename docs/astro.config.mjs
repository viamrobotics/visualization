import starlight from '@astrojs/starlight'
import svelte from '@astrojs/svelte'
import { defineConfig } from 'astro/config'

export default defineConfig({
	site: 'https://viam-labs.github.io',
	base: '/motion-tools/',
	integrations: [
		starlight({
			title: 'Motion Tools',
			description: '3D visualization SDK for Viam',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/viam-labs/motion-tools',
				},
			],
			editLink: {
				baseUrl: 'https://github.com/viam-labs/motion-tools/edit/main/docs/',
			},
			sidebar: [
				{ label: 'Overview', link: '/' },
				{
					label: 'Getting Started',
					items: [{ label: 'Visualizer Guide', slug: 'visualizer' }],
				},
				{
					label: 'SDK',
					items: [
						{ label: 'SDK Guide', slug: 'sdk' },
						{ label: 'draw API', slug: 'draw-api' },
						{ label: 'client/api API', slug: 'client-api' },
					],
				},
				{
					label: 'Embedding',
					items: [{ label: 'Embedding Guide', slug: 'embedding' }],
				},
				{
					label: 'Guides',
					items: [
						{
							label: 'Migration v1 → v2',
							slug: 'migration-v1-to-v2',
						},
					],
				},
			],
		}),
		svelte(),
	],
})

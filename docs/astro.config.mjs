import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import starlightThemeNova from 'starlight-theme-nova'

const base = process.env.DOCS_BASE ?? '/visualization/'
const site = process.env.DOCS_SITE ?? 'https://viamrobotics.github.io'

export default defineConfig({
	site,
	base,
	integrations: [
		starlight({
			plugins: [starlightThemeNova()],
			title: 'Viam Visualization',
			description: '3D visualization and debugging interface for Viam robotics.',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/viamrobotics/visualization',
				},
			],
			customCss: [
				'@fontsource-variable/roboto-mono',
				'@fontsource-variable/public-sans',
				'./src/tailwind.css',
			],
			sidebar: [
				{ label: 'Introduction', link: '/' },
				{
					label: 'Guides',
					items: [
						{ label: 'Running locally', link: '/guides/local-usage/' },
						{ label: 'Embedding <Visualizer />', link: '/guides/embedding/' },
						{
							label: 'Implementing WorldStateStoreService',
							link: '/guides/worldstatestore/',
						},
					],
				},
				{
					label: 'API reference',
					items: [
						{
							label: 'client/api',
							link: '/api/client-api/',
							badge: { text: 'beta', variant: 'tip' },
						},
						{ label: 'draw', link: '/api/draw/' },
					],
				},
				{
					label: 'Migration guides',
					items: [
						{
							label: 'v1 → v2',
							link: '/migration/v1-to-v2/',
							badge: { text: 'preview', variant: 'success' },
						},
					],
				},
				{ label: 'Playground', link: '/playground/snapshot' },
			],
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
})

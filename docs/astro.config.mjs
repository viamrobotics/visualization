import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import remarkGfm from 'remark-gfm'
import starlightThemeNova from 'starlight-theme-nova'

const base = process.env.DOCS_BASE ?? '/visualization/'
const site = process.env.DOCS_SITE ?? 'https://viamrobotics.github.io'

export default defineConfig({
	site,
	base,
	// astro 6.4.x stopped applying GFM to .mdx by default, which flattened every
	// pipe table into a paragraph. Declaring the plugin explicitly restores it and
	// does not depend on the astro version.
	markdown: {
		remarkPlugins: [remarkGfm],
	},
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
						{ label: 'Deep linking', link: '/guides/deep-linking/' },
						{
							label: 'Implementing WorldStateStoreService',
							link: '/guides/worldstatestore/',
						},
					],
				},
				{
					label: 'Plugins',
					items: [
						{ label: 'Authoring plugins', link: '/plugins/authoring/' },
						{ label: 'Plugin dependencies', link: '/plugins/dependencies/' },
						{ label: '<BuildFrames />', link: '/plugins/build-frames/' },
						{ label: '<ControlWidgets />', link: '/plugins/control-widgets/' },
						{ label: '<Debug />', link: '/plugins/debug/' },
						{ label: '<DrawService />', link: '/plugins/draw-service/' },
						{ label: '<FileDrop />', link: '/plugins/file-drop/' },
						{ label: '<Focus />', link: '/plugins/focus/' },
						{ label: '<FramePov />', link: '/plugins/frame-pov/' },
						{ label: '<Fullscreen />', link: '/plugins/fullscreen/' },
						{ label: '<Logs />', link: '/plugins/logs/' },
						{ label: '<MeasureTool />', link: '/plugins/measure-tool/' },
						{ label: '<Monitor />', link: '/plugins/monitor/' },
						{ label: '<MotionPlanReplayer />', link: '/plugins/motion-plan-replayer/' },
						{ label: '<SelectionTool />', link: '/plugins/selection/' },
						{ label: '<Settings />', link: '/plugins/settings/' },
						{ label: '<Skybox />', link: '/plugins/skybox/' },
						{ label: '<TopDownLock />', link: '/plugins/top-down-lock/' },
						{ label: '<WorldTree />', link: '/plugins/world-tree/' },
						{ label: '<XR />', link: '/plugins/xr/' },
						{ label: '<LLMSceneBuilder />', link: '/plugins/llm-scene-builder/' },
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

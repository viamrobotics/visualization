import { defineConfig } from "vitepress";

export default defineConfig({
	title: "Motion Tools",
	description: "3D visualization SDK for Viam",

	base: "/motion-tools/",
	ignoreDeadLinks: [/localhost/],

	themeConfig: {
		nav: [
			{ text: "Guide", link: "/" },
			{ text: "Visualizer", link: "/visualizer" },
			{ text: "SDK", link: "/sdk" },
			{ text: "Embedding", link: "/embedding" },
		],

		sidebar: [
			{
				text: "Getting Started",
				items: [
					{ text: "Overview", link: "/" },
					{ text: "Visualizer Guide", link: "/visualizer" },
				],
			},
			{
				text: "SDK",
				items: [
					{ text: "SDK Guide", link: "/sdk" },
					{ text: "draw API", link: "/draw-api" },
					{ text: "client/api API", link: "/client-api" },
				],
			},
			{
				text: "Embedding",
				items: [{ text: "Embedding Guide", link: "/embedding" }],
			},
			{
				text: "Guides",
				items: [
					{ text: "Migration v1 → v2", link: "/migration-v1-to-v2" },
				],
			},
		],

		socialLinks: [
			{
				icon: "github",
				link: "https://github.com/viam-labs/motion-tools",
			},
		],

		search: {
			provider: "local",
		},

		editLink: {
			pattern:
				"https://github.com/viam-labs/motion-tools/edit/main/docs/:path",
		},
	},
});

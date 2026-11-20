<!--
@component

An empty space that is usually filled with content, with a message explaining why it is
empty. Ported from the Viam app's `null-state.svelte` so both read the same.

```svelte
<NullState
	illustration="stars"
	title="Nothing in the scene yet"
/>
```
-->
<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { ClassValue } from 'svelte/elements'

	interface Props {
		title: string
		text?: string
		illustration?: 'stars' | 'none'
		class?: ClassValue
		children?: Snippet
	}

	const { title, text, illustration = 'none', class: className, children }: Props = $props()
</script>

<div
	class={[
		'border-light flex h-full grow flex-col items-center justify-center border border-dashed py-16 text-center',
		className,
	]}
>
	{#if illustration === 'stars'}
		<!-- Illustration art, so its grays are the app's own fills rather than tokens. -->
		<svg
			class="mb-6 h-auto max-w-full"
			width="144"
			height="57"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<g clip-path="url(#null-state-stars)">
				<path
					d="M30.4 13.1h-1.1C29.3 10.3 27 8 24 8V6.8c2.9 0 5.2-2.3 5.2-5.2h1.1c0 2.9 2.3 5.2 5.2 5.2V8a5.2 5.2 0 0 0-5.2 5.1zm-3.6-5.7a6.3 6.3 0 0 1 3 3 6.3 6.3 0 0 1 3.1-3 6.3 6.3 0 0 1-3-3 6.3 6.3 0 0 1-3.1 3zm106 11.9h-1.3c0-2.9-2.3-5.2-5.1-5.2V13a5.2 5.2 0 0 0 5.1-5.1h1.2c0 2.8 2.3 5.1 5.2 5.1v1.2a5.2 5.2 0 0 0-5.2 5.2zm-3.7-5.8a6.4 6.4 0 0 1 3 3.1 6.3 6.3 0 0 1 3.1-3 6.3 6.3 0 0 1-3-3.2 6.4 6.4 0 0 1-3.1 3.1zM85.5 56.2h-1.2c0-2.8-2.3-5.2-5.1-5.2V50c2.8 0 5.1-2.3 5.1-5.2h1.2c0 2.9 2.3 5.2 5.1 5.2V51a5.2 5.2 0 0 0-5.1 5.2zm-3.7-5.7a6.3 6.3 0 0 1 3.1 3 6.3 6.3 0 0 1 3-3 6.3 6.3 0 0 1-3-3.1 6.3 6.3 0 0 1-3 3zm-48.2-8.9h-1.2c0-2.8-2.3-5.1-5.1-5.1v-1.2c2.8 0 5.1-2.3 5.1-5.1h1.2c0 2.8 2.3 5.1 5.2 5.1v1.2a5.2 5.2 0 0 0-5.2 5.1zM30 36a6.3 6.3 0 0 1 3.1 3 6.3 6.3 0 0 1 3.1-3 6.3 6.3 0 0 1-3-3 6.3 6.3 0 0 1-3.2 3zM9 32.2H7.9c0-1-.2-9.5-7-9.5v-1.1c6.8 0 7-8.6 7-9.5H9c0 1 .1 9.5 7 9.5v1.1c-6.9 0-7 8.6-7 9.5zm-5-10c2.6 1 3.8 3.6 4.5 5.8.6-2.2 1.9-4.7 4.5-5.8-2.6-1.2-4-3.7-4.5-6-.7 2.3-2 4.8-4.5 6zm102.7 19.2h-1.2c0-1-.2-9.5-7-9.5v-1.2c6.8 0 7-8.5 7-9.5h1.2c0 1 .2 9.5 7 9.5V32c-6.8 0-7 8.5-7 9.5zm-5-10c2.5 1 3.8 3.5 4.4 5.8.6-2.3 1.9-4.8 4.5-5.9-2.6-1-3.9-3.6-4.5-5.8-.6 2.2-1.9 4.7-4.5 5.8z"
					fill="#9C9CA4"
				/>
				<path
					d="M72.4 41.6a13.8 13.8 0 1 0-8.7-26.2 13.8 13.8 0 0 0 8.7 26.2z"
					fill="#F1F1F4"
				/>
				<path
					d="M68.1 42.9a14.4 14.4 0 0 1-5.6-27.7 14.3 14.3 0 0 1 11 0 14.3 14.3 0 0 1 7.9 7.8 14.3 14.3 0 0 1 0 11 14.3 14.3 0 0 1-7.8 7.8 14.3 14.3 0 0 1-5.5 1zm0-27.6a13.2 13.2 0 1 0 5 25.4 13.1 13.1 0 0 0 7.2-7.2 13.1 13.1 0 0 0 0-10 13.1 13.1 0 0 0-7.2-7.2 13.2 13.2 0 0 0-5-1z"
					fill="#9C9CA4"
				/>
				<path
					d="M53.2 38.4c-2 0-4-.4-4.5-1.8-1-2.2 2.2-5.1 5.1-7.2l.7 1c-4 2.9-5.1 4.9-4.7 5.7.3.8 2.1 1.5 6.3.9 4-.6 8.8-2 13.8-4.1 10.8-4.5 17.4-10 16.5-12-.3-1-2.5-1.6-7.6-.7l-.2-1.1c3.6-.7 8-1 8.9 1.3C89 24 79.8 30.1 70.4 34a60.2 60.2 0 0 1-17.2 4.4z"
					fill="#9C9CA4"
				/>
			</g>
			<defs>
				<clipPath id="null-state-stars">
					<path
						fill="#fff"
						transform="translate(0 .5)"
						d="M0 0h144v56H0z"
					/>
				</clipPath>
			</defs>
		</svg>
	{/if}

	<!-- Smaller than the app's `text-base` and `text-sm`, to match this tool's dense panels. -->
	<p class="text-subtle-1 mb-1 text-xs font-semibold">
		{title}
	</p>

	{#if text}
		<p class="text-subtle-2 mb-0 w-full max-w-[40rem] text-xs [text-wrap:balance]">
			{text}
		</p>
	{/if}

	{@render children?.()}
</div>

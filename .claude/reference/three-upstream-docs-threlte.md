# Threlte Upstream Documentation

The Threlte half of `three-upstream-docs.md`, installed because this repo chose the Threlte
guide.

- Index: https://threlte.xyz/llms.txt
- Full docs: https://threlte.xyz/llms-full.txt

The index is a link list over the Threlte 8 docs, carrying absolute URLs you can fetch directly.
The full file is roughly 500 KB, which does not belong in a context window whole. Read the index,
pick the page, fetch that page.

Threlte 7 is archived separately at https://v7.threlte.xyz.

Threlte 8, the Svelte 5 and runes release, is the largest migration in Threlte's history. It
replaces slot props with snippets, redesigns the plugin system, and narrows automatic
disposal to directly referenced objects.

## Svelte, in a Threlte repo

Svelte ships a first-party MCP server, documented at https://svelte.dev/docs/ai/mcp. It
serves Svelte and SvelteKit documentation and statically analyzes generated Svelte code. It
covers the Svelte half of a Threlte component, not the Three.js half.

## Upgrading

Upgrade Threlte, three, its type definitions, and Svelte together, and read all four
changelogs. The packages are version-coupled, and a mismatch, such as the Threlte extras
runes-mode incompatibility during the Svelte 5 transition, is a real failure mode.

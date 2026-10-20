# Upstream Documentation

Three.js and its framework bindings publish their documentation in `llms.txt` form. Fetch the
relevant one instead of writing an API call from memory. Three.js has a large body of
outdated tutorial material on the web, so a signature recalled rather than checked is often one
that was removed several major versions ago.

Three.js ships no official MCP server. These URLs are the whole integration.

Every `llms-full.txt` size below was measured on 2026-08-06. They only grow, so treat each one
as a floor.

## Three.js

- Guidance: https://threejs.org/docs/llms.txt
- Full API: https://threejs.org/docs/llms-full.txt

The short file is not an index. It is a set of instructions for generating Three.js code, and it
opens by rejecting the `<script src="...three.min.js">` CDN pattern in favor of import maps. Read
it first. The full file is the complete API reference including TSL, at roughly 130 KB.

`https://threejs.org/llms.txt` also resolves, but it only points at the two URLs above.

## Upgrading

Treat the Three.js migration guide as required reading on every upgrade, since releases
arrive frequently and routinely contain breaking changes. Budget the work as routine,
frequent maintenance rather than an occasional project. Skipping many revisions and
upgrading all at once is materially harder than making small upgrades along the way.

## Framework bindings installed in this repo

- Threlte: `three-upstream-docs-threlte.md` beside this file.

---
paths:
  - '**/*.svelte'
  - '**/*.css'
---

# Frontend Aesthetics

Every UI change should look intentional and high-craft. The failure mode to avoid is "AI slop."

Viam already made the distinctive choices: the fonts, the palette, the components. Here, "slop" means _ignoring the design system_: hardcoded hex instead of tokens, inconsistent spacing/density, re-inventing components prime already ships, missing interaction states, and weak hierarchy. Do not add new fonts, color schemes, gradients, or "creative" layouts.

**Source of truth: https://design.viam.com**, implemented as Viam's prime config — `@viamrobotics/tailwind-config` (tokens/utilities) and `@viamrobotics/tweakpane-config` (tweakpane theme). The design system's own words: "consistency across applications"; "use PRIME elements over native when possible, and extend or modify PRIME as necessary"; colors "match one-to-one with our tailwind config." `viam-context.md` already covers _how/when_ to WebFetch design.viam.com and the Viam repos. Follow it; don't re-verify what it covers.

This rule is about **visual craft + design-system fidelity**. Svelte code conventions (runes, `class={[...]}` array syntax, Svelte MCP) live in `svelte.md`; on-demand rendering / `invalidate()` lives in `threlte-scene.md`; generic token/scale/contrast mechanics live in the kit's `design.md` (query actual values with `design.mjs`). Cross-reference them; don't duplicate.

## Components first

Prefer PRIME components (`@viamrobotics/prime-core`) over native or hand-rolled ones: `Button`, `IconButton`, `Icon`, `Tooltip`, `Input`, `Select`, `Switch`, `Label`, toasts (`useToast` / `ToastContainer`). Before building a control, check design.viam.com — if PRIME has it (Badge, Banner, Breadcrumbs, Code Snippet, Collapsible, Context menu, Modal, Pill, Progress, Radio, Tabs, Toggle Buttons, Tooltip), use it and extend PRIME rather than replacing it.

- Stateful primitives PRIME doesn't cover (tabs, toggle-group, popover, floating-panel, collapsible, tree-view) → `@zag-js/*`, the established pattern.
- Control panels (sliders, points, color, rotation) → `svelte-tweakpane-ui`, themed globally by `primeTheme` from `@viamrobotics/tweakpane-config` via `ThemeUtils.setGlobalDefaultTheme(primeTheme)` (set once in `App.svelte`, client-side only). Don't restyle tweakpane ad hoc — fix the theme.
- Icons: prime-core `Icon` (typed `IconName`) is preferred; `lucide-svelte` exists, use only where PRIME has no equivalent. Decorative icons get `aria-hidden="true"`.

## Color & tokens

Use the semantic Tailwind tokens from Viam's prime config (`@viamrobotics/tailwind-config`). **Never hardcode hex for UI chrome.**

- Text: `text-heading`, `text-default`, `text-subtle-1`, `text-subtle-2`, `text-disabled`, `text-link`.
- Surfaces: `bg-extralight` / `bg-light` / `bg-medium` / `bg-dark`; hover fills `ghost-light` / `ghost-medium`.
- Borders: `border-light` / `border-medium` / `border-dark`.
- Grayscale `gray-1` (lightest) … `gray-9` (darkest) when a raw step is genuinely needed.
- Status: `danger` / `warning` / `success` / `info`, each `-dark` / `-medium` / `-light`. Use for meaning, not decoration.
- `shadow-sm`; `z-max` for top-layer overlays.

Don't: `style="color:#4e4f52"`, `class="text-[#7a7c80]"`. Do: `class="text-subtle-1"`.

Reserve brand/illustration colors (`power-wire`, `cyberpunk`, `solar-power`, `hologram`, `raspberry`, `pcb`, `pixel-*`, …) for illustrations / 3D / brand art — never general UI chrome.

**Legitimate hex** (not slop): WebGL/canvas drawing like shaders, `<canvas>` fills, slider gradients (e.g. the `src/lib/plugins/XR/*` widgets) can't use Tailwind tokens. Don't flag those.

## Typography

The config ships the distinctive choices. Apply the family for the role:

- `font-space-grotesk` — display / headings.
- `font-public-sans` — body / UI text.
- `font-roboto-mono` — numeric & data (poses, coordinates, IDs, tables; cf. `.visualization-table` in `app.css`).

`app.css` sets `body { font-family: system-ui }` globally. The prime fonts are **not** inherited everywhere, so set the family explicitly where it matters. Build hierarchy with weight/size/color tokens, not invented type scales.

## Spacing, layout & density

- Use Tailwind's spacing scale consistently. Don't sprinkle arbitrary `px` where a scale step fits. Match the density of neighboring panels. This is a dense tooling UI, not a marketing page.
- Reuse existing layout idioms (overlay panels, dashboard, left-pane tree, details cards) rather than inventing a new one.
- Hierarchy: heading → label → data, separated by `text-heading`/`text-default` vs `text-subtle-1`/`text-subtle-2` — not size alone.

## Component states & interaction

A control isn't done until every state is handled — missing states is the #1 slop tell here.

- **hover / focus-visible / active / disabled** on every interactive element.
- **loading** and **empty** states for any async or list/data view (placeholder/skeleton, not a blank box).
- Disabled should read as disabled (`text-disabled`, reduced affordance). Prefer `aria-disabled` over `disabled` when it must stay focusable (see Accessibility below).
- Lean on prime components for correct states instead of re-deriving them.

## Motion

Restrained and purposeful — a 3D tool, not a landing page. CSS-only transitions on hover/focus/expand. Prefer the config's `animate-wiggle` (nudge/error) and `animate-blink` (attention) over bespoke keyframes. Respect `prefers-reduced-motion`. (Three.js: after scene/material mutations call `invalidate()` — see `threlte-scene.md`; never drive animation from `$effect`.)

## Accessibility

- Use semantic elements and correct ARIA roles; label all interactive elements.
- Hide decorative icons with `aria-hidden="true"`.
- Use `aria-disabled` instead of `disabled` when the element must remain focusable.
- Contrast: pair `text-*` tokens with appropriate surfaces (don't put `text-subtle-2` on `bg-medium`).
- Keep a visible `focus-visible` ring; never remove focus outlines without a replacement.
- Hit targets large enough to use comfortably.

## Done? Self-check before finishing any UI change

- [ ] Used a PRIME component where one exists (checked design.viam.com); didn't re-invent a primitive.
- [ ] Semantic tokens only — no hardcoded hex for chrome; brand/illustration colors not used as chrome.
- [ ] Correct font role; family set explicitly where needed.
- [ ] Spacing/density consistent with neighbors; clear hierarchy.
- [ ] hover / focus-visible / active / disabled handled; loading + empty for async/lists.
- [ ] Motion restrained; respects `prefers-reduced-motion`.
- [ ] Visual a11y: contrast holds, focus visible, hit targets adequate.
- [ ] Matches design.viam.com; looks intentional, not generic.

When reviewing or writing code that touches Viam APIs or SDK types, use the tools below to verify behavior against the authoritative sources before commenting or making changes. Limit lookups to 2–3 per session to avoid wasting turns.

## Viam docs

Use `WebFetch` on `https://docs.viam.com/` to understand what a resource type (arm, camera, sensor, etc.) is supposed to do — its RPC semantics, method signatures, and expected behavior.

Use `WebFetch` on `https://design.viam.com/` to understand the style guide and general design conventions and available UI components from the `prime-core` library.

## Viam source repos

Use `gh api` to fetch source directly from the four Viam repos:

```bash
# Fetch a specific file (response is base64-encoded content)
gh api repos/viamrobotics/<repo>/contents/<path> --jq '.content' | base64 -d

# Search code across a repo
gh api "search/code?q=<term>+repo:viamrobotics/<repo>" --jq '.items[] | "\(.path): \(.text_matches[0].fragment // "")"'
```

| Repo                  | Best for                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| `api`                 | Canonical `.proto` definitions — prefer this over `rdk` for RPC contracts |
| `viam-typescript-sdk` | TypeScript types, client patterns, exported API surface                   |
| `viam-svelte-sdk`     | Svelte stores and utilities wrapping the TS SDK                           |
| `test-widgets`        | Prebaked UI components for testing machine SDK APIs                       |
| `rdk`                 | Go service interface signatures and constants (keyword search only)       |

## When to look things up

- Code uses a type or method from `@viamrobotics/viam-typescript-sdk` or `@viamrobotics/viam-svelte-sdk` and the usage looks incorrect — verify the actual exported API in the source repo.
- A PR adds or modifies a new widget for a resource type or one from `@viamrobotics/test-widgets` — fetch the corresponding `.proto` from `viamrobotics/api` to verify field names and RPC signatures.
- A method name or field is inconsistent with Viam naming conventions — check the proto definition.
- A review comment needs to describe what a resource method does — use `WebFetch` on the Viam docs rather than guessing.

## RDK (Go) limitations

`viamrobotics/rdk` is Go. Code search is keyword-only — it cannot follow interface implementations across packages. To find a service interface, search for the exact declaration (e.g. `type ArmService interface`). For anything requiring runtime or type-system reasoning, prefer the `.proto` in `viamrobotics/api` instead.

# Changesets

This directory holds [changeset](https://github.com/changesets/changesets) entries that drive `@viamrobotics/motion-tools` versioning and changelog generation.

When you make a user-visible change to the package, add a changeset:

```bash
pnpm changeset
```

Pick a release type (patch / minor / major) and write a short summary — that summary becomes the entry in [`CHANGELOG.md`](../CHANGELOG.md) at release time. Internal-only changes (refactors, tests, docs-site tweaks, CI) don't need a changeset.

For changeset CLI specifics see the [upstream docs](https://github.com/changesets/changesets/blob/main/docs/common-questions.md). For project-wide context see the [motion-tools docs](https://viamrobotics.github.io/visualization/).

---
paths:
  # Scoped to src/ so Playwright e2e suites (e2e/*.test.ts) stay out of scope.
  - 'src/**/*.test.ts'
  - 'src/**/*.spec.ts'
---

# Testing

This rule decides whether a test is worth writing, where it lives, what it covers, and how it
is named. It applies to any
test runner with a `describe`/`it` shape. For suffix conventions, build-exclusion advice, and
runnable examples, see `testing-typescript.md` or `testing-javascript.md`, whichever guide
this repo installed.

The rule assumes a test you are writing. When you are changing behavior instead, the test
that covers it is part of the change, not a follow-up.

## Rule — follow without deliberation

### Whether the test is worth writing

- **A test earns its place by failing when the behavior breaks.** That is the whole bar. Check
  it: introduce the bug the test is supposed to catch, run the test, confirm it goes red, then
  revert. A test that stays green under a deliberate bug is not weak coverage, it is zero
  coverage, and deleting it loses nothing.
- **A flaky test is quarantined and fixed at the root, never deleted to reach green.**
  Common causes: isolation (shared state), unsettled async, and a real clock (time).
- **Do not run that check when the bug would kill the process instead of failing an
  assertion.** A guard against a native panic, a stack overflow, or an out-of-memory has that
  shape. Removing it ends the run rather than reddening a test, so it proves nothing a reader
  can distinguish from an unrelated crash, and the revert may never happen because the process
  that would have done it is gone. Pin the guard's observable result instead: that the call
  returns the error, with the test surviving to assert it. That version is falsifiable the
  ordinary way, because deleting the guard changes a returned value.
- **Never write a test to move the coverage number.** Coverage reports which lines ran, not
  which behaviors are pinned, and a line runs fine under a test that asserts nothing about it.
  Find the decision nothing covers and test that. The number follows.
- **Assert the value, not that a value exists.** `toBeDefined`, `toBeTruthy`, and `length > 0`
  pass on almost every wrong answer. Name the result you expect. If you cannot say what it
  should be, you do not yet understand the behavior well enough to pin it.
- **Write the expected value as a literal.** Computing it with the same expression the code
  uses, or by calling the same library the code calls, makes the test agree with the
  implementation by construction. It then passes on every bug the two share, which is most of
  them.
- **Do not test code you did not write.** That a validation library rejects a malformed string,
  or that a framework fires its own lifecycle hook, is covered by that project's suite. Test the
  schema you declared and what your code does with the result.
- **Skip the passthrough.** A getter that returns a field, a re-export, a wrapper that forwards
  its arguments unchanged. There is no decision to get wrong, so there is nothing to pin. A
  wrapper that supplies a default, reorders arguments, or swallows an error is not a
  passthrough, and that decision is worth a test.
- **Asserting that a mock was called is not an assertion about behavior.** `toHaveBeenCalledWith`
  pins how the code reached its result, so it breaks on a refactor that kept the result correct
  and passes when the collaborator's contract changed underneath. Assert what the caller
  observes. Keep the call check only where making the call IS the observable effect, such as a
  request that has to reach a server.
- **When a test fails, fix the code or rewrite the test deliberately.** Loosening an assertion
  until it passes turns one real failure into permanent green, and the next reader cannot tell
  that happened. If the behavior genuinely changed, state the new behavior in the name and in
  the assertion.

### Placement

- **Tests colocate in a `__tests__` directory beside the code they cover.** A test for
  `src/core/drift.ts` is `src/core/__tests__/drift.test.ts`. Close enough to find without a
  search, in a directory of its own so it does not clutter the module listing. Checked
  mechanically: only that a test file sits inside a `__tests__` directory. Whether it is
  beside the right subject stays a human read, since a real corpus check found 40% of test
  files name a tree or a concept rather than one sibling file, which is a judgment call, not
  a path match.
- **Split by SUBJECT, not by unit versus end-to-end, and setup does not count toward the
  subject.** A test that builds a repo, runs one command, then checks the result is about that
  command. Counting the setup makes everything look cross-cutting and nothing colocates. One
  file per subject, a `describe` per concern, and never a parallel `.e2e.test.ts` tier that
  splits one subject across two places. Checked mechanically: only the `.e2e.test.ts` tier.
  Whether a file is genuinely split by subject is still a human read.
- **Assume every test has an owner.** "This one is cross-cutting" is almost always a misreading.
  An entry point is a unit, and so is a test that drives several components as long as one of
  them is the subject. Before filing something as ownerless, name the source file it is about
  and confirm that file does not exist. A test about a whole built tree is owned by that tree,
  so it goes in `<that-tree>/__tests__/`.
- **Shared fixtures and setup are not tests, so they do not go in a `__tests__/`.** Put them in
  a plainly named `test/` directory. The distinction is worth holding: `__tests__/` means tests
  live here, `test/` means testing infrastructure lives here. A `__tests__/` containing no tests
  misleads every reader who greps it.

### What to test, and at which level

- **Prefer a unit test over an end-to-end test for the same assertion.** If a decision is
  pure, test the function that makes it. Driving the whole program to observe one branch is
  slower, and the failure names the program rather than the decision.
- **End-to-end tests prove wiring, once.** Cover that the pieces are connected and that the
  real boundaries work, such as exit codes, file writes, and process behavior. Branch coverage
  belongs to units.
- **Extract a pure function when a test wants one.** A decision buried in an I/O function can
  be lifted out with the I/O left at the call site. Let the test drive the extraction rather
  than restructuring code no test asked about.
- **Real implementations by default.** Mock only I/O boundaries: network, file system, time,
  child processes, and randomness. Mocking your own module means the test no longer knows
  whether the two halves still agree.
- **Stage from data, not by running another component.** Building a test's starting state by
  invoking a second subject couples the two, so a regression in the setup path fails every
  suite that used it and the failure names the wrong thing. Prefer a fixture, a factory, or a
  snapshot of the state. Where producing that state is genuinely expensive, produce it once and
  copy it per test. The same goes for verification: do not ask a second component whether the
  first one worked, assert the specific thing you care about.
- **Cover the failure path.** A function with an error branch and no test for it has an
  untested error branch. This is the most common real gap.
- **One behavior per test.** If the name needs "and", it is two tests. Expensive setup is not
  a reason to fuse assertions. Hoist the setup into `beforeEach` instead.
- **Use a case table for one rule over many inputs.** `it.each` keeps the rule in one place and
  names each case in the output.

### Structure

- **Arrange, Act, Assert, in that order, separated by a blank line.** Set up the inputs, perform
  the one action under test, then assert on the result. The shape should be visible at a glance
  without reading the code.
- **Never label the phases with comments.** No `// Arrange`, no `// Act`. The blank lines
  carry the structure.
- **One Act per test.** Two actions means two behaviors, which means two tests. A test that
  arranges, acts, asserts, then acts again is a sequence, and it fails without telling you which
  step broke.
- **Push a complicated Arrange into a named helper**, kept in the test file next to the tests
  that use it. `forgeManifestHash(root, path)` says what five lines of hashing and JSON
  rewriting are for.
- **Assert is where the test earns its keep.** A test whose Arrange dwarfs its Assert is usually
  testing setup, or is missing an extraction from the code under test.

### Naming

- **The description states the observable behavior.** After the subject in `describe`, the
  `it` reads as a sentence: `describe('deepMerge')` plus
  `it('recurses into nested objects rather than clobbering them')`.
- **No identifier prefixes.** No `JM1:`, no case numbers, no ticket IDs. They convey nothing,
  and renumbering makes every reference stale. A unique behavioral description is the handle.
- **Name what the caller observes, not how the code does it.** `it('rejects an expired token')`
  survives a refactor. `it('calls validateExpiry')` does not.
- **Put failure-only context in the `expect` message, not a comment.** The second argument to
  `expect` prints when the assertion fails, which is the moment the context is needed.

### Never

- **No comments in a test file, as the working default.** A test is read far more often than it
  is written, and it has three places to put meaning that a comment does not: the `describe`
  name, the `it` name, and a named helper. Use those. If you are about to write a comment, one
  of the three is wrong.
  - An assertion that needs explaining means the `it` name is wrong. Fix the name.
  - A setup step that needs explaining means it should be a named helper.
  - Context that only matters when the test fails goes in the second argument to `expect`,
    where it actually prints.
  - What survives is the rare domain fact a reader could not infer and no name can carry, such
    as why a malformed input is deliberately tolerated. Keep those short and about the SYSTEM,
    never about the test.
- **No file header comment on a test file.** This is stricter than `code-comments.md`'s
  exception for files that export nothing. A suite's contract is its `describe` names. A header
  restates them, then goes stale.
- **No banner or section dividers inside a test file.** Needing signposts to navigate a suite
  means it should be several suites, split by the unit under test.
- **No assertion-free test.** A test that runs code and asserts nothing passes forever and
  proves nothing. Vitest's `expect.requireAssertions` catches this and is worth turning on.
  Checked mechanically: that some config or setup file turns it on. Whether an individual
  test actually asserts something is Vitest's own runtime check, not this checker's.
- **No snapshot standing in for an assertion.** A snapshot of a large structure fails on every
  unrelated change and gets updated without being read. Assert the fields the behavior is
  about.
- **No test that reaches into private state to verify a result.** Assert what a caller can see.
  A test coupled to internals blocks the refactor it was supposed to protect.
- **No conditional in a test body.** An `if` around an assertion means the test has two cases.
  Write two tests, or a case table.
- **No loop around an assertion.** A `for` over cases stops at the first failure and the output
  names the test, not the case that broke. Use `it.each` when each case is its own behavior.
  When the behavior is "all of them", collect the failures and assert once on the collection,
  so the message lists every one instead of the first. Loops in Arrange are fine.
- **No test that polices a repo convention instead of production behavior.** A suite asserting
  where files live, how they are named, or how they are formatted is a lint rule wearing a test
  costume. It fails on a rename that broke nothing and passes while the product is broken. Put
  the convention in a rule, or in the linter if it must be mechanical. A test earns its place by
  telling you something about the code that ships.

### Where other rules apply

- Whether a comment should exist at all: see `code-comments.md`.
- How the sentence inside a description or comment reads: see `prose-voice.md`.
- Naming, function size, and dead code in test helpers: see `code-cleanliness.md`. Helpers are
  code and the same rules apply.

## Checked mechanically

`test-layout.mjs`, run over a list of test file paths plus the build output directory, catches
colocation in `__tests__`, the `.e2e.test.ts` tier, and non-test files sitting inside a
`__tests__/`, each noted above. `test-config.mjs`, run over a repo's vitest config and setup
files, catches whether `expect.requireAssertions` is turned on anywhere. Everything else in
this rule, including whether a test would actually fail on the bug it claims to catch, is a
human read.

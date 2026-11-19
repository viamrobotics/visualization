#!/usr/bin/env node
/**
 * PostToolUse(Edit|Write|MultiEdit) hook. Runs prettier on the one file the tool just
 * wrote, so formatting never reaches files Claude did not touch.
 *
 * Prettier only reformats and never changes meaning, so it is safe mid-sequence. ESLint
 * autofix is not, and runs once per turn from `lint-edited-files.mjs` instead.
 *
 * Every path exits 0. A formatter failure, such as a syntax error in a half-finished edit,
 * is left for the Stop-time lint to report rather than interrupting the edit sequence.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
// Under the 30s hook timeout in settings.json.
const PRETTIER_TIMEOUT_MS = 25_000

try {
	const input = JSON.parse(readFileSync(0, 'utf8'))
	const filePath = input?.tool_input?.file_path
	if (!filePath) process.exit(0)

	const abs = path.resolve(root, filePath)
	const rel = path.relative(root, abs)
	if (rel.startsWith('..') || !existsSync(abs)) process.exit(0)

	// `--ignore-unknown` skips extensions prettier has no parser for. Explicit paths still
	// honor `.prettierignore`, so generated files stay untouched.
	spawnSync(path.join(root, 'node_modules/.bin/prettier'), ['--write', '--ignore-unknown', rel], {
		cwd: root,
		stdio: 'ignore',
		timeout: PRETTIER_TIMEOUT_MS,
	})
} catch {
	// A formatting hook must never break the edit that triggered it.
}

process.exit(0)

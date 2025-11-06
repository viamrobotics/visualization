#!/usr/bin/env node

import { execSync } from 'node:child_process'

try {
	execSync('bun --version', { stdio: 'ignore' })
} catch {
	console.error(
		'❌ Bun is not installed. Please install it from https://bun.sh before running this project. Note: do not install via PNPM since this causes issues.'
	)
	process.exit(1)
}

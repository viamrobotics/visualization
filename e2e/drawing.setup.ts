import { test as setup } from '@playwright/test'
import { execSync } from 'node:child_process'

// Once, before any drawing worker starts. The generator rewrites the gitignored .pb.gz
// files in place, so running it per worker races the workers that drop them.
setup('generate snapshot fixtures', () => {
	execSync(
		'go test -run ^TestGeneratingSnapshots$ github.com/viamrobotics/visualization/draw -count=1',
		{ encoding: 'utf8' }
	)
})

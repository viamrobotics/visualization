import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import MenuItem from '../MenuItem.svelte'

describe('<MenuItem>', () => {
	it('names the item by its label and describes it by its description', () => {
		render(MenuItem, { props: { label: 'Add files', description: 'STL or PLY meshes' } })

		const item = screen.getByRole('menuitem', { name: 'Add files' })

		expect(item).toHaveAccessibleDescription('STL or PLY meshes')
	})

	it('marks an item that opens another screen as a submenu', () => {
		render(MenuItem, { props: { label: 'Obstacle', opensSubmenu: true } })

		expect(screen.getByRole('menuitem', { name: 'Obstacle' })).toHaveAttribute(
			'aria-haspopup',
			'menu'
		)
	})

	it('leaves a plain item without a popup', () => {
		render(MenuItem, { props: { label: 'Simple' } })

		expect(screen.getByRole('menuitem', { name: 'Simple' })).not.toHaveAttribute('aria-haspopup')
	})
})

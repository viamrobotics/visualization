import { mount } from 'svelte'

import ScopedScenePage from './ScopedScenePage.svelte'

const target = document.querySelector('#app')

if (!target) {
	throw new Error('No #app element to mount into')
}

mount(ScopedScenePage, { target })

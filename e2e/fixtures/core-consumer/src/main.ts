import { mount } from 'svelte'

import SceneViewPage from './SceneViewPage.svelte'

const target = document.querySelector('#app')

if (!target) {
	throw new Error('No #app element to mount into')
}

mount(SceneViewPage, { target })

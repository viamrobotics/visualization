<script lang="ts">
	import { T } from '@threlte/core/webgpu'

	import { InstancedArrows } from '$lib/three/InstancedArrows/InstancedArrows'

	const COUNT = 2_000_000
	const SIDE = Math.ceil(Math.sqrt(COUNT))
	const SPACING_MM = 60
	const WAVE = 0.0005

	const poses = new Float32Array(COUNT * 6)
	const colors = new Uint8Array(COUNT * 3)

	for (let index = 0; index < COUNT; index += 1) {
		const x = ((index % SIDE) - SIDE / 2) * SPACING_MM
		const y = (Math.floor(index / SIDE) - SIDE / 2) * SPACING_MM
		const pose = index * 6
		const color = index * 3

		poses[pose] = x
		poses[pose + 1] = y
		poses[pose + 2] = 0
		poses[pose + 3] = Math.sin(x * WAVE)
		poses[pose + 4] = Math.cos(y * WAVE)
		poses[pose + 5] = 1

		colors[color] = (index % SIDE) % 256
		colors[color + 1] = Math.floor(index / SIDE) % 256
		colors[color + 2] = 200
	}

	const arrows = new InstancedArrows({ count: COUNT })
	arrows.update({ poses, colors })

	$effect(() => {
		return () => arrows.dispose()
	})
</script>

<T is={arrows} />

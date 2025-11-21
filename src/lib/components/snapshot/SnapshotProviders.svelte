<script lang="ts">
	import type { Snippet } from 'svelte'
	import { provideSelection } from '$lib/hooks/useSelection.svelte'
	import { provideCameraControls, provideTransformControls } from '$lib/hooks/useControls.svelte'
	import { provideArrows } from '$lib/hooks/useArrows.svelte'
	import { provideOrigin } from '$lib/components/xr/useOrigin.svelte'
	import type { PassSnapshot } from '$lib/snapshot'
	import { RenderArmModels } from '$lib/snapshot'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import type { CameraPose } from '$lib/hooks/useControls.svelte'

	interface Props {
		snapshot: PassSnapshot
		children: Snippet<[{ cameraPose: CameraPose }]>
	}

	let { snapshot, children }: Props = $props()

	const settings = useSettings()

	const getArmModel = (model: RenderArmModels) => {
		switch (model) {
			case RenderArmModels.COLLIDERS:
				return 'colliders'
			case RenderArmModels.COLLIDERS_AND_MODEL:
				return 'colliders+model'
			case RenderArmModels.MODEL:
				return 'model'
			default:
				return 'colliders+model'
		}
	}

	$effect(() => {
		const metadata = snapshot.sceneMetadata
		if (!metadata) return

		settings.current.grid = metadata.grid ?? settings.current.grid
		settings.current.gridCellSize = metadata.gridCellSize ?? settings.current.gridCellSize
		settings.current.gridSectionSize = metadata.gridSectionSize ?? settings.current.gridSectionSize
		settings.current.gridFadeDistance =
			metadata.gridFadeDistance ?? settings.current.gridFadeDistance

		settings.current.pointSize = metadata.pointSize ?? settings.current.pointSize
		settings.current.pointColor = metadata.pointColor ?? settings.current.pointColor
		settings.current.lineWidth = metadata.lineWidth ?? settings.current.lineWidth
		settings.current.lineDotSize = metadata.lineDotSize ?? settings.current.lineDotSize

		settings.current.renderArmModels = getArmModel(
			metadata.renderArmModels ?? RenderArmModels.COLLIDERS_AND_MODEL
		)
	})

	const cameraPose = $derived.by((): CameraPose => {
		const camera = snapshot.sceneMetadata?.sceneCamera
		if (!camera) return { position: [3, 3, 3], lookAt: [0, 0, 0] }

		return {
			position: [
				(camera.position?.x ?? 0) / 1000,
				(camera.position?.y ?? 0) / 1000,
				(camera.position?.z ?? 0) / 1000,
			],
			lookAt: [
				(camera.lookAt?.x ?? 0) / 1000,
				(camera.lookAt?.y ?? 0) / 1000,
				(camera.lookAt?.z ?? 0) / 1000,
			],
		}
	})

	provideCameraControls(() => cameraPose)
	provideTransformControls()
	provideArrows()
	provideOrigin()

	provideSelection()
</script>

{@render children?.({ cameraPose })}

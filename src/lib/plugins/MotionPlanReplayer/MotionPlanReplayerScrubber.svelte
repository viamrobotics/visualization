<script lang="ts">
	import Scrubber from './Scrubber.svelte'
	import { useMotionPlanReplayer } from './useMotionPlanReplayer.svelte'

	const ctx = useMotionPlanReplayer()
</script>

<Scrubber
	currentStep={ctx.currentStep}
	totalSteps={ctx.totalSteps}
	onseek={(index) => ctx.setStep(index)}
/>

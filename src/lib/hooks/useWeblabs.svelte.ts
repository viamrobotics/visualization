import { getContext, setContext } from "svelte";

const key = Symbol('weblabs-context');

const EXPERIMENT_COOKIES_TO_CHECK = [
    'MOTION_TOOLS_EDIT_FRAME'
]

interface Context {
    activeExperiments: Set<string>
}

export const provideWeblabs = () => {
    const activeExperiments = $state(new Set<string>());

    $effect(() => {
        for (const experiment of EXPERIMENT_COOKIES_TO_CHECK) {
            if (document.cookie.includes(experiment)) {
                activeExperiments.add(experiment)
            }
        }
    })

    setContext<Context>(key, { activeExperiments })
}

export const useWeblabs = () => {
    return getContext<Context>(key)
}
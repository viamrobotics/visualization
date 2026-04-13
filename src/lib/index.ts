export { default as MotionTools } from './components/App.svelte'

// Plugins
export { default as SelectionTool } from './components/Selection/Tool.svelte'
export { default as PCD } from './components/PCD.svelte'

// ECS
export * as relations from './ecs/relations'
export * as traits from './ecs/traits'
export * as selectionTraits from './components/Selection/traits'
export { useSelectionPlugin as useSelection } from './components/Selection/useSelectionPlugin.svelte'
export { default as FloatingPanel } from './components/overlay/FloatingPanel.svelte'

export { provideWorld, useWorld } from './ecs/useWorld'
export { useQuery } from './ecs/useQuery.svelte'
export { useTrait } from './ecs/useTrait.svelte'

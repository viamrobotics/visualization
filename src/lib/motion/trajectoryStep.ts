/** One step: joint values per component, positional by joint index. Radians, or mm if prismatic. */
export type TrajectoryStep = Record<string, number[]>

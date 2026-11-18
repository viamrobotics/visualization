package motionplan

import (
	"context"
	"math/rand"
	"sync"
	"time"

	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/motionplan"
	"go.viam.com/rdk/motionplan/armplanning"
	"go.viam.com/rdk/motionplan/ik"
	"go.viam.com/rdk/referenceframe"
)

// TODO: replace with go.viam.com/rdk/motionplan/armplanning/mpserver.InspectIK once it moves to a
// package that does not import github.com/viam-labs/motion-tools. Linking mpserver registers
// motion-tools' copy of draw/v1, which panics against this repo's draw/v1 at init.
// Copied from rdk v1.10.0 mpserver/ik.go.

// ikInspectCell describes a single IK solution emitted from one seed, scored and validated the
// same way getSolutions would score and validate it.
type ikInspectCell struct {
	// Cost is IK score, but without any "neutral bias".
	Cost float64
	// Exact is true when the solver considered the goal met (GoalDist below the goal threshold).
	Exact bool
	// Inputs is the solution configuration.
	Inputs *referenceframe.LinearInputs

	// Valid is true when the configuration itself passes all state constraints (no self-collision,
	// no obstacle collision, within bounds, ...). When false, StateError explains why.
	Valid      bool
	StateError error

	// CheckPathOK is true when the straight-line interpolation from the start configuration to this
	// solution passes all constraints. Only meaningful when Valid is true. When false, CheckPathError
	// explains why.
	CheckPathOK    bool
	CheckPathError error

	// CheckPathFeedback carries diagnostics from the CheckPath call, including the last
	// configuration along the interpolated path that still satisfied all constraints. Only
	// meaningful when CheckPathOK is false.
	CheckPathFeedback armplanning.PathFeedback
}

type ikInspectTable struct {
	SeedResults [][]ikInspectCell
	SeedLabels  []string
}

func inspectIK(ctx context.Context, logger logging.Logger,
	req *armplanning.PlanRequest,
	segmentStart referenceframe.FrameSystemInputs,
	segmentGoal referenceframe.FrameSystemPoses,
	numSolutions int,
) (*ikInspectTable, error) {
	var meta armplanning.PlanMeta
	pc, err := armplanning.NewPlanContext(ctx, logger, req, &meta)
	if err != nil {
		return nil, err
	}

	linearSchema := pc.GetLinearInputsSchema()
	startLinear, err := linearSchema.GetLinearInputs(segmentStart)
	if err != nil {
		return nil, err
	}

	psc, err := armplanning.NewPlanSegmentContext(ctx, pc, startLinear, segmentGoal)
	if err != nil {
		return nil, err
	}

	solver, err := ik.CreateNloptSolver(logger, -1, true, true, time.Second)
	if err != nil {
		return nil, err
	}

	//nolint: gosec
	randSeed := rand.New(rand.NewSource(int64(req.PlannerOptions.RandomSeed)))
	ikMinimizingFunc := pc.LinearizeFSMetric(req.PlannerOptions.GetGoalMetric(segmentGoal))
	retChan := make(chan *ik.Solution, 10)

	sss, err := armplanning.NewSolutionSolvingState(ctx, psc, logger)
	if err != nil {
		return nil, err
	}

	var ret ikInspectTable
	ret.SeedLabels = sss.SeedDescriptions
	for seedIdx, seed := range sss.LinearSeeds {
		seeds := [][]float64{seed}
		limits := [][]referenceframe.Limit{sss.SeedLimits[seedIdx]}

		ctxWithCancel, cancel := context.WithCancel(ctx)
		wg := sync.WaitGroup{}
		wg.Add(1)
		go func() {
			//nolint: errcheck
			_, _, _ = solver.Solve(ctxWithCancel, retChan, nil,
				seeds, limits, ikMinimizingFunc, randSeed.Int())
			cancel()
			wg.Done()
		}()

		rowIdx := len(ret.SeedResults)
		ret.SeedResults = append(ret.SeedResults, make([]ikInspectCell, 0, numSolutions))
		cells := &ret.SeedResults[rowIdx]
		for len(ret.SeedResults[rowIdx]) < numSolutions {
			select {
			case <-ctxWithCancel.Done():
				// Solver error
				*cells = append(*cells, ikInspectCell{Cost: -1.0})
			case solution := <-retChan:
				inputs, err := linearSchema.FloatsToInputs(solution.Configuration)
				if err != nil {
					return nil, err
				}

				_, finalStateErr := psc.Checker.CheckStateFSConstraints(ctx, &motionplan.StateFS{
					Configuration: inputs,
					FS:            req.FrameSystem,
				})

				var pathFeedback armplanning.PathFeedback
				pathError := psc.CheckPath(ctx, startLinear, inputs, false, &pathFeedback)

				stepArc := &motionplan.SegmentFS{
					StartConfiguration: startLinear,
					EndConfiguration:   inputs,
					FS:                 req.FrameSystem,
				}
				*cells = append(*cells, ikInspectCell{
					Cost: pc.ConfigurationDistanceFunc(stepArc) +
						armplanning.NeutralBias(linearSchema.GetLimits(), solution.Configuration),
					Exact:             solution.Exact,
					Inputs:            inputs,
					Valid:             finalStateErr == nil,
					StateError:        finalStateErr,
					CheckPathOK:       pathError == nil,
					CheckPathError:    pathError,
					CheckPathFeedback: pathFeedback,
				})
			}
		}
		cancel()
		wg.Wait()
	}

	return &ret, nil
}

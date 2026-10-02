package motionplan

import (
	motionplanv1 "github.com/viamrobotics/visualization/motionplan/v1"
	"go.viam.com/rdk/referenceframe"
)

func seedResults(table *ikInspectTable) []*motionplanv1.IKSeedResult {
	results := make([]*motionplanv1.IKSeedResult, 0, len(table.SeedLabels))
	for seedIdx, seedLabel := range table.SeedLabels {
		if seedIdx >= len(table.SeedResults) {
			break
		}

		cells := table.SeedResults[seedIdx]
		solutions := make([]*motionplanv1.IKSolution, 0, len(cells))
		for _, cell := range cells {
			solutions = append(solutions, ikSolution(cell))
		}
		results = append(results, &motionplanv1.IKSeedResult{Seed: seedLabel, Solutions: solutions})
	}
	return results
}

// nil Inputs means IK produced nothing, StateError only explains an invalid configuration,
// and CheckPath* only applies once the configuration is valid.
func ikSolution(cell ikInspectCell) *motionplanv1.IKSolution {
	solution := &motionplanv1.IKSolution{
		Cost:               cell.Cost,
		ConfigurationValid: cell.Valid,
	}

	if cell.Inputs == nil {
		return solution
	}
	solution.Configuration = jointPositions(cell.Inputs.ToFrameSystemInputs())

	if !cell.Valid {
		solution.ConfigurationError = errorMessage(cell.StateError)
		return solution
	}

	checkPathOK := cell.CheckPathOK
	solution.CheckpathValid = &checkPathOK
	if checkPathOK {
		return solution
	}

	solution.FirstError = errorMessage(cell.CheckPathError)
	isObstacleCollision := cell.CheckPathFeedback.IsObstacleCollision
	solution.IsObstacleCollision = &isObstacleCollision
	// Unset when the start configuration itself violated a constraint, so there is no good prefix.
	if lastGood := cell.CheckPathFeedback.LastGoodInputs; lastGood != nil {
		solution.LastGoodInputs = jointPositions(lastGood.ToFrameSystemInputs())
	}
	return solution
}

func jointPositions(inputs referenceframe.FrameSystemInputs) map[string]*motionplanv1.JointPositions {
	positions := make(map[string]*motionplanv1.JointPositions, len(inputs))
	for frameName, values := range inputs {
		positions[frameName] = &motionplanv1.JointPositions{Values: values}
	}
	return positions
}

func errorMessage(err error) *string {
	if err == nil {
		return nil
	}
	message := err.Error()
	return &message
}

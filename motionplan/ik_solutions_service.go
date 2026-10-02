// Package motionplan serves offline RDK motion-planning inspection over Connect-RPC.
package motionplan

import (
	"bytes"
	"context"
	"errors"
	"fmt"

	"connectrpc.com/connect"
	motionplanv1 "github.com/viamrobotics/visualization/motionplan/v1"
	"github.com/viamrobotics/visualization/motionplan/v1/motionplanv1connect"
	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/motionplan/armplanning"
)

// Matches RDK's own IK inspection.
const defaultNumSolutions = 10

var _ motionplanv1connect.MotionPlanServiceHandler = (*MotionPlanService)(nil)

// MotionPlanService runs RDK IK inspection against uploaded motion-plan JSON.
type MotionPlanService struct {
	logger logging.Logger
}

// NewMotionPlanService returns a MotionPlanService.
func NewMotionPlanService() *MotionPlanService {
	return &MotionPlanService{logger: logging.NewLogger("ik-inspect")}
}

// GetIKSolutions returns per-seed IK solutions for the plan request's first goal.
func (s *MotionPlanService) GetIKSolutions(
	ctx context.Context,
	req *connect.Request[motionplanv1.GetIKSolutionsRequest],
) (*connect.Response[motionplanv1.GetIKSolutionsResponse], error) {
	if len(req.Msg.GetPlanContent()) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("plan content is required"))
	}

	planRequest, _, err := armplanning.RequestFromReader(bytes.NewReader(req.Msg.GetPlanContent()))
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("decode motion plan: %w", err))
	}
	if len(planRequest.Goals) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("plan has no goals"))
	}
	if planRequest.StartState == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("plan is missing start_state"))
	}

	numSolutions := int(req.Msg.GetNumSolutions())
	if numSolutions <= 0 {
		numSolutions = defaultNumSolutions
	}

	table, err := inspectIK(
		ctx,
		s.logger,
		planRequest,
		planRequest.StartState.Configuration(),
		planRequest.Goals[0].Poses(),
		numSolutions,
	)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("inspect IK: %w", err))
	}

	return connect.NewResponse(&motionplanv1.GetIKSolutionsResponse{Results: seedResults(table)}), nil
}

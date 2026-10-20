package main

import (
	"fmt"
	"io"
	"math"
	"strings"

	"google.golang.org/protobuf/encoding/protojson"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// printReport writes report to w, as protojson when asJSON and as a human summary otherwise.
func printReport(w io.Writer, name string, report *kinematicsv1.ValidationReport, asJSON bool) error {
	if asJSON {
		data, err := protojson.MarshalOptions{UseProtoNames: true, Multiline: true}.Marshal(report)
		if err != nil {
			return fmt.Errorf("marshal report: %w", err)
		}
		_, err = fmt.Fprintf(w, "%s\n", data)
		return err
	}

	var summary strings.Builder
	fmt.Fprintf(&summary, "model: %s (%d bytes)\n", name, report.GetModelBytes())
	fmt.Fprintf(&summary, "dof: %d\n", report.GetDof())
	if p := report.GetTcpPose(); p != nil {
		fmt.Fprintf(&summary, "TCP pose: x=%.3f y=%.3f z=%.3f mm, ov=(%.4f, %.4f, %.4f) theta=%.3f deg\n",
			p.GetX(), p.GetY(), p.GetZ(), p.GetOX(), p.GetOY(), p.GetOZ(), p.GetTheta())
	}
	for _, link := range report.GetLinks() {
		kind := "mesh"
		if link.GetShape() == kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX {
			kind = "box"
		}
		e := link.GetExtent()
		fmt.Fprintf(&summary, "link %-16s %-4s %6d tris  %.1f × %.1f × %.1f mm\n",
			link.GetId(), kind, link.GetTriangles(), e.GetX(), e.GetY(), e.GetZ())
	}
	for _, input := range report.GetInputs() {
		writeInputRow(&summary, input)
	}
	if len(report.GetFailures()) == 0 {
		summary.WriteString("ok\n")
	}
	if len(report.GetWarnings()) > 0 {
		summary.WriteString("Warnings:\n")
		for _, warning := range report.GetWarnings() {
			fmt.Fprintf(&summary, "  %s\n", warning)
		}
	}
	for _, failure := range report.GetFailures() {
		fmt.Fprintf(&summary, "FAIL: %s\n", failure)
	}
	_, err := io.WriteString(w, summary.String())
	return err
}

// writeInputRow prints one model input with its limits. RDK reports revolute limits in radians,
// shown here in degrees to match the spec.
func writeInputRow(summary *strings.Builder, input *kinematicsv1.InputReport) {
	if input.GetType() == kinematicsv1.JointType_JOINT_TYPE_REVOLUTE {
		fmt.Fprintf(summary, "input %-15s revolute   %.1f to %.1f deg\n",
			input.GetJoint(), input.GetMin()*180/math.Pi, input.GetMax()*180/math.Pi)
		return
	}
	fmt.Fprintf(summary, "input %-15s prismatic  %.1f to %.1f mm\n", input.GetJoint(), input.GetMin(), input.GetMax())
}

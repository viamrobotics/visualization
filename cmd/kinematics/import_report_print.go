package main

import (
	"fmt"
	"io"
	"strings"

	"google.golang.org/protobuf/encoding/protojson"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// printImportReport writes what the URDF import read, placed, dropped, and renamed.
func printImportReport(w io.Writer, report *kinematicsv1.ImportReport, asJSON bool) error {
	if asJSON {
		data, err := protojson.MarshalOptions{UseProtoNames: true, Multiline: true}.Marshal(report)
		if err != nil {
			return fmt.Errorf("marshal import report: %w", err)
		}
		_, err = fmt.Fprintf(w, "%s\n", data)
		return err
	}
	var out strings.Builder
	fmt.Fprintf(&out, "URDF: %s\n", report.GetUrdfPath())
	if report.GetTcpLink() != "" {
		fmt.Fprintf(&out, "TCP link: %s\n", report.GetTcpLink())
	} else {
		fmt.Fprintf(&out, "TCP link: none matched. Candidates: %s\nre-run with -tcp <link>\n",
			strings.Join(report.GetTcpCandidates(), ", "))
	}
	writeList(&out, "dropped", report.GetDropped())
	writeList(&out, "renamed", report.GetRenamed())
	writeList(&out, "visual fallback", report.GetVisualFallbacks())
	_, err := io.WriteString(w, out.String())
	return err
}

func writeList(out *strings.Builder, title string, items []string) {
	if len(items) == 0 {
		return
	}
	fmt.Fprintf(out, "%s (%d):\n", title, len(items))
	for _, item := range items {
		fmt.Fprintf(out, "  %s\n", item)
	}
}

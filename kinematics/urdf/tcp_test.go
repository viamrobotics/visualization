package urdf

import (
	"strings"
	"testing"

	"go.viam.com/rdk/spatialmath"
)

// tcpRobot is a base with a moving link and one geometry-less leaf per name, each 1 m along X.
func tcpRobot(leaves ...string) string {
	body := `<link name="base"/>` + boxLink("arm") + joint("shoulder", "revolute", "base", "arm", `<limit lower="0" upper="1"/>`)
	for _, leaf := range leaves {
		body += `<link name="` + leaf + `"/>` + joint("to_"+leaf, "fixed", "arm", leaf, `<origin xyz="1 0 0"/>`)
	}
	return robotXML(body)
}

func TestTCPPickFollowsTheNamingOrder(t *testing.T) {
	cases := []struct {
		leaves []string
		want   string
	}{
		{[]string{"my_tool", "has_tcp_inside", "flange_tcp", "tool0"}, "tool0"},
		{[]string{"my_tool", "has_tcp_inside", "flange_tcp"}, "flange_tcp"},
		{[]string{"my_tool", "has_tcp_inside", "tcp"}, "tcp"},
		{[]string{"my_tool", "has_tcp_inside"}, "has_tcp_inside"},
		{[]string{"other", "my_tool"}, "my_tool"},
		{[]string{"other", "tool00"}, "tool00"},
	}
	for _, test := range cases {
		imported := mustConvertInline(t, tcpRobot(test.leaves...))
		if imported.Report.GetTcpLink() != test.want {
			t.Errorf("leaves %v: tcp_link = %q, want %q", test.leaves, imported.Report.GetTcpLink(), test.want)
		}
	}
}

func TestTCPTakesTheLinkPoseAndNearestMovingJoint(t *testing.T) {
	imported := mustConvertInline(t, tcpRobot("tool0"))

	if got := imported.Spec.GetTcpParent(); got != "shoulder" {
		t.Fatalf("tcp_parent = %q, want shoulder", got)
	}
	if got := spatialmath.NewPoseFromProtobuf(imported.Spec.GetTcpPose()).Point(); got.X != 1000 {
		t.Fatalf("tcp_pose = %v, want x 1000 mm", got)
	}
}

func TestGeometrylessLeavesAreTCPCandidates(t *testing.T) {
	imported := mustConvertInline(t, tcpRobot("alpha", "beta"))
	if got := strings.Join(imported.Report.GetTcpCandidates(), ","); got != "alpha,beta" {
		t.Fatalf("tcp_candidates = %q, want alpha,beta", got)
	}
}

func TestTCPOptionOverridesNamingAndMustNameALink(t *testing.T) {
	imported, err := convertInline(t, tcpRobot("tool0", "alpha"), nil, Options{TCPLink: "alpha"})
	if err != nil || imported.Report.GetTcpLink() != "alpha" {
		t.Fatalf("tcp_link = %q, err %v, want alpha", imported.Report.GetTcpLink(), err)
	}
	_, err = convertInline(t, tcpRobot("tool0"), nil, Options{TCPLink: "missing"})
	requireError(t, err, "missing")
}

func TestNoTCPMatchLeavesTheTCPAtTheBase(t *testing.T) {
	imported := mustConvertInline(t, tcpRobot("alpha"))
	if imported.Report.GetTcpLink() != "" || imported.Spec.GetTcpParent() != "" {
		t.Fatalf("tcp_link = %q, tcp_parent = %q, want both empty", imported.Report.GetTcpLink(), imported.Spec.GetTcpParent())
	}
	if got := spatialmath.NewPoseFromProtobuf(imported.Spec.GetTcpPose()).Point(); got.X != 0 || got.Y != 0 || got.Z != 0 {
		t.Fatalf("tcp_pose = %v, want the origin", got)
	}
}

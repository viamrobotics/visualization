package kinematics

import (
	"runtime/debug"
	"strings"
	"testing"

	"go.viam.com/test"
)

func TestCLIVersion(t *testing.T) {
	rev := []debug.BuildSetting{{Key: "vcs.modified", Value: "false"}, {Key: "vcs.revision", Value: "abc123"}}
	for _, tc := range []struct {
		name string
		info *debug.BuildInfo
		ok   bool
		want string
	}{
		{"tagged", &debug.BuildInfo{Main: debug.Module{Version: "v2.3.4"}, Settings: rev}, true, "v2.3.4"},
		{"devel with revision", &debug.BuildInfo{Main: debug.Module{Version: "(devel)"}, Settings: rev}, true, "abc123"},
		{"empty version with revision", &debug.BuildInfo{Settings: rev}, true, "abc123"},
		{"devel without revision", &debug.BuildInfo{Main: debug.Module{Version: "(devel)"}}, true, "main"},
		{"no build info", &debug.BuildInfo{Main: debug.Module{Version: "v2.3.4"}}, false, "main"},
		{"dirty pseudo-version", &debug.BuildInfo{Main: debug.Module{Version: "v1.45.2-0.20261019163351-a68a0fbac002+dirty"}, Settings: append(rev, debug.BuildSetting{Key: "vcs.modified", Value: "true"})}, true, "main"},
		{"clean pseudo-version", &debug.BuildInfo{Main: debug.Module{Version: "v1.45.2-0.20261019163351-a68a0fbac002"}, Settings: rev}, true, "v1.45.2-0.20261019163351-a68a0fbac002"},
		{"devel with modified revision", &debug.BuildInfo{Main: debug.Module{Version: "(devel)"}, Settings: append(rev, debug.BuildSetting{Key: "vcs.modified", Value: "true"})}, true, "main"},
		{"nil info", nil, true, "main"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			test.That(t, cliVersion(tc.info, tc.ok), test.ShouldEqual, tc.want)
		})
	}
}

func TestRegenerateCommand(t *testing.T) {
	cmd := RegenerateCommand("kinematics.json", "kinematics")
	test.That(t, cmd, test.ShouldStartWith, "go run "+CLIPackage+"@")
	test.That(t, cmd, test.ShouldEndWith, " build kinematics.json -o kinematics")
	test.That(t, strings.Contains(cmd, "@latest"), test.ShouldBeFalse)

	quoted := RegenerateCommand("my spec.json", "out")
	test.That(t, quoted, test.ShouldEndWith, " build 'my spec.json' -o out")
	test.That(t, shellQuote("it's"), test.ShouldEqual, `'it'\''s'`)
}

func TestRegenerateVendorCommand(t *testing.T) {
	plain := RegenerateVendorCommand("vendor/arm.urdf", "kinematics", VendorBuildOptions{})
	test.That(t, plain, test.ShouldEqual, RegenerateCommand("vendor/arm.urdf", "kinematics"))

	full := RegenerateVendorCommand("vendor/arm pkg", "kinematics", VendorBuildOptions{TCPLink: "tool0", MaxTriangles: 2000})
	test.That(t, full, test.ShouldStartWith, "go run "+CLIPackage+"@")
	test.That(t, full, test.ShouldEndWith, " build 'vendor/arm pkg' -o kinematics -tcp tool0 -max-triangles 2000")

	onlyTCP := RegenerateVendorCommand("a.zip", "out", VendorBuildOptions{TCPLink: "my tool"})
	test.That(t, onlyTCP, test.ShouldEndWith, " build a.zip -o out -tcp 'my tool'")
	onlyBudget := RegenerateVendorCommand("a.zip", "out", VendorBuildOptions{MaxTriangles: 7})
	test.That(t, onlyBudget, test.ShouldEndWith, " build a.zip -o out -max-triangles 7")
}

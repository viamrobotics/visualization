package urdf

import (
	"testing"
)

func TestJointClashingWithALinkGetsAJointSuffix(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		boxLink("base")+boxLink("elbow")+joint("elbow", "revolute", "base", "elbow", `<limit lower="0" upper="1"/>`)))

	if got := jointByID(t, imported.Spec, "elbow_joint"); got == nil {
		t.Fatal("joint was not renamed")
	}
	if linkByID(t, imported.Spec, "elbow").GetParent() != "elbow_joint" {
		t.Fatalf("link parent = %q, want the renamed joint", linkByID(t, imported.Spec, "elbow").GetParent())
	}
	if !contains(imported.Report.GetRenamed(), "elbow -> elbow_joint") {
		t.Fatalf("renamed = %v", imported.Report.GetRenamed())
	}
}

func TestReservedIDsAreRenamedAndReported(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		boxLink("root")+boxLink("tcp")+boxLink("wrist_origin")+
			joint("j1", "fixed", "root", "tcp", "")+joint("j2", "fixed", "tcp", "wrist_origin", "")))

	for old, renamed := range map[string]string{"root": "root_link", "tcp": "tcp_link", "wrist_origin": "wrist_origin_link"} {
		linkByID(t, imported.Spec, renamed)
		if !contains(imported.Report.GetRenamed(), old+" -> "+renamed) {
			t.Errorf("renamed = %v, missing %q -> %q", imported.Report.GetRenamed(), old, renamed)
		}
	}
}

func TestReservedJointIDIsRenamedAndMimicFollowsTheRename(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		`<link name="base"/>`+boxLink("a")+boxLink("b")+
			joint("tcp", "revolute", "base", "a", `<limit lower="0" upper="1"/>`)+
			joint("follower", "revolute", "base", "b", `<mimic joint="tcp"/>`)))

	if got := jointByID(t, imported.Spec, "follower").GetMimic().GetJoint(); got != "tcp_joint" {
		t.Fatalf("mimic joint = %q, want tcp_joint", got)
	}
}

package urdf

import (
	"math"
	"testing"

	"go.viam.com/rdk/spatialmath"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func TestExactlyOneRootLink(t *testing.T) {
	_, err := convertInline(t, robotXML(boxLink("left")+boxLink("right")+boxLink("child")+
		joint("j", "fixed", "left", "child", "")), nil, Options{})
	requireError(t, err, "root", "left", "right")
}

func TestRootLinkIsTheOneThatIsNoJointsChild(t *testing.T) {
	imported := mustConvertInline(t, robotXML(boxLink("child")+boxLink("base")+joint("j", "fixed", "base", "child", "")))
	if parent := linkByID(t, imported.Spec, "base").GetParent(); parent != "" {
		t.Fatalf("root link parent = %q, want empty", parent)
	}
}

func TestRevoluteAndPrismaticLimitsConvertUnits(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		`<link name="base"/>`+boxLink("a")+boxLink("b")+
			joint("turn", "revolute", "base", "a", `<limit lower="-1.5707963267948966" upper="3.141592653589793"/>`)+
			joint("slide", "prismatic", "a", "b", `<limit lower="0.01" upper="0.25"/>`)))

	turn := jointByID(t, imported.Spec, "turn")
	if turn.GetType() != kinematicsv1.JointType_JOINT_TYPE_REVOLUTE || math.Abs(turn.GetLower()+90) > 1e-9 || math.Abs(turn.GetUpper()-180) > 1e-9 {
		t.Fatalf("revolute = %v, want -90 to 180 degrees", turn)
	}
	slide := jointByID(t, imported.Spec, "slide")
	if slide.GetType() != kinematicsv1.JointType_JOINT_TYPE_PRISMATIC || math.Abs(slide.GetLower()-10) > 1e-9 || math.Abs(slide.GetUpper()-250) > 1e-9 {
		t.Fatalf("prismatic = %v, want 10 to 250 mm", slide)
	}
}

func TestContinuousJointBecomesWideRevoluteAndIsReported(t *testing.T) {
	imported := mustConvertInline(t, robotXML(`<link name="base"/>`+boxLink("a")+joint("spin", "continuous", "base", "a", "")))

	spin := jointByID(t, imported.Spec, "spin")
	if spin.GetType() != kinematicsv1.JointType_JOINT_TYPE_REVOLUTE || spin.GetLower() != -360 || spin.GetUpper() != 360 {
		t.Fatalf("continuous = %v, want revolute -360 to 360", spin)
	}
	if !contains(imported.Report.GetDropped(), "continuous limits in spin") {
		t.Fatalf("dropped = %v", imported.Report.GetDropped())
	}
}

func TestFixedJointsFoldIntoTheNearestMovingAncestor(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		boxLink("base")+boxLink("a")+boxLink("b")+boxLink("c")+boxLink("d")+
			joint("fix_a", "fixed", "base", "a", `<origin xyz="0 0 1"/>`)+
			joint("elbow", "revolute", "a", "b", `<origin xyz="1 0 0"/><limit lower="0" upper="1"/>`)+
			joint("fix_c", "fixed", "b", "c", `<origin xyz="0 2 0"/>`)+
			joint("wrist", "revolute", "c", "d", `<origin xyz="0 0 3"/><limit lower="0" upper="1"/>`)))

	for id, wantParent := range map[string]string{"base": "", "a": "", "b": "elbow", "c": "elbow", "d": "wrist"} {
		if got := linkByID(t, imported.Spec, id).GetParent(); got != wantParent {
			t.Errorf("link %s parent = %q, want %q", id, got, wantParent)
		}
	}
	if got := jointByID(t, imported.Spec, "elbow").GetParent(); got != "" {
		t.Errorf("elbow parent = %q, want empty", got)
	}
	if got := jointByID(t, imported.Spec, "wrist").GetParent(); got != "elbow" {
		t.Errorf("wrist parent = %q, want elbow", got)
	}
	// c sits 1 m up, 1 m out, and 2 m across, through one fixed joint, one moving joint, and one more fixed joint.
	if got := spatialmath.NewPoseFromProtobuf(linkByID(t, imported.Spec, "c").GetOrigin()).Point(); got.X != 1000 || got.Y != 2000 || got.Z != 1000 {
		t.Errorf("c origin = %v, want 1000 2000 1000 mm", got)
	}
	if len(imported.Spec.GetJoints()) != 2 {
		t.Errorf("joints = %d, want 2", len(imported.Spec.GetJoints()))
	}
}

func TestFloatingAndPlanarJointsFailNamingTheJoint(t *testing.T) {
	for _, jointType := range []string{"floating", "planar"} {
		_, err := convertInline(t, robotXML(`<link name="base"/>`+boxLink("a")+joint("loose_joint", jointType, "base", "a", "")), nil, Options{})
		requireError(t, err, "loose_joint", jointType)
	}
}

func TestMimicDefaultsMultiplierAndConvertsOffsetLikeTheSource(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		`<link name="base"/>`+boxLink("a")+boxLink("b")+boxLink("c")+boxLink("d")+
			joint("drive", "revolute", "base", "a", `<limit lower="0" upper="1"/>`)+
			joint("follow", "revolute", "base", "b", `<limit lower="-5" upper="5"/><mimic joint="drive" offset="0.5"/>`)+
			joint("slide", "prismatic", "base", "c", `<limit lower="0" upper="1"/>`)+
			joint("follow_slide", "prismatic", "base", "d", `<mimic joint="slide" multiplier="-2" offset="0.25"/>`)))

	follow := jointByID(t, imported.Spec, "follow")
	if follow.GetMimic().GetJoint() != "drive" || follow.GetMimic().GetMultiplier() != 1 || math.Abs(follow.GetMimic().GetOffset()-0.5*180/math.Pi) > 1e-9 {
		t.Fatalf("mimic = %v, want drive, multiplier 1, offset 28.6479 degrees", follow.GetMimic())
	}
	if follow.GetLower() != 0 || follow.GetUpper() != 0 {
		t.Fatalf("mimic joint limits = %v to %v, want ignored", follow.GetLower(), follow.GetUpper())
	}
	slide := jointByID(t, imported.Spec, "follow_slide").GetMimic()
	if slide.GetMultiplier() != -2 || slide.GetOffset() != 250 {
		t.Fatalf("prismatic mimic = %v, want multiplier -2, offset 250 mm", slide)
	}
}

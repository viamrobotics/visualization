package api

import (
	"testing"

	"go.viam.com/test"
)

var (
	sourceUUID = []byte{0x0a, 0x0b}
	targetUUID = []byte{0x0c, 0x0d}
)

func TestCreateRelationshipSendsSourceAndRelationship(t *testing.T) {
	fake := startFake(t)

	err := CreateRelationship(CreateRelationshipOptions{
		SourceUUID: sourceUUID,
		TargetUUID: targetUUID,
		Type:       "HoverLink",
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.createRelationship, test.ShouldHaveLength, 1)
	req := fake.createRelationship[0]
	test.That(t, req.GetSourceUuid(), test.ShouldResemble, sourceUUID)
	test.That(t, req.GetRelationship().GetTargetUuid(), test.ShouldResemble, targetUUID)
	test.That(t, req.GetRelationship().GetType(), test.ShouldEqual, "HoverLink")
}

// IndexMapping is only forwarded when non-empty, so the server applies its own
// default rather than receiving an empty expression to evaluate.
func TestCreateRelationshipIndexMapping(t *testing.T) {
	for _, tc := range []struct {
		name    string
		mapping string
		want    *string
	}{
		{name: "empty is left unset", mapping: "", want: nil},
		{name: "an expression is forwarded", mapping: "index * 2", want: strPtr("index * 2")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			err := CreateRelationship(CreateRelationshipOptions{
				SourceUUID:   sourceUUID,
				TargetUUID:   targetUUID,
				Type:         "HoverLink",
				IndexMapping: tc.mapping,
			})
			test.That(t, err, test.ShouldBeNil)

			test.That(
				t,
				fake.createRelationship[0].GetRelationship().IndexMapping,
				test.ShouldResemble,
				tc.want,
			)
		})
	}
}

func TestDeleteRelationshipSendsBothUUIDs(t *testing.T) {
	fake := startFake(t)

	err := DeleteRelationship(DeleteRelationshipOptions{
		SourceUUID: sourceUUID,
		TargetUUID: targetUUID,
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.deleteRelationship, test.ShouldHaveLength, 1)
	req := fake.deleteRelationship[0]
	test.That(t, req.GetSourceUuid(), test.ShouldResemble, sourceUUID)
	test.That(t, req.GetTargetUuid(), test.ShouldResemble, targetUUID)
}

// Neither call validates its UUIDs locally. Empty ones reach the server, which
// answers InvalidArgument. Pinning that keeps the division of labour explicit.
func TestRelationshipCallsDoNotValidateUUIDsLocally(t *testing.T) {
	fake := startFake(t)

	test.That(t, CreateRelationship(CreateRelationshipOptions{Type: "x"}), test.ShouldBeNil)
	test.That(t, DeleteRelationship(DeleteRelationshipOptions{}), test.ShouldBeNil)

	test.That(t, fake.createRelationship, test.ShouldHaveLength, 1)
	test.That(t, fake.deleteRelationship, test.ShouldHaveLength, 1)
}

func TestRelationshipCallsRequireAVisualizer(t *testing.T) {
	requireNoServer(t)

	err := CreateRelationship(CreateRelationshipOptions{SourceUUID: sourceUUID})
	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)

	err = DeleteRelationship(DeleteRelationshipOptions{SourceUUID: sourceUUID})
	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
}

func TestRelationshipCallsWrapRPCFailures(t *testing.T) {
	for _, tc := range []struct {
		name      string
		procedure string
		call      func() error
		wantMsg   string
	}{
		{
			name:      "create",
			procedure: "CreateRelationship",
			call: func() error {
				return CreateRelationship(CreateRelationshipOptions{SourceUUID: sourceUUID})
			},
			wantMsg: "CreateRelationship failed",
		},
		{
			name:      "delete",
			procedure: "DeleteRelationship",
			call: func() error {
				return DeleteRelationship(DeleteRelationshipOptions{SourceUUID: sourceUUID})
			},
			wantMsg: "DeleteRelationship failed",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)
			fake.errs[tc.procedure] = errRPCBoom

			err := tc.call()

			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, tc.wantMsg)
		})
	}
}

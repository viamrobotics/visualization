package kinematics

import (
	"testing"

	"go.viam.com/test"
)

func specJSON(meshPath string) []byte {
	return []byte(`{"name":"t","links":[{"id":"l","mesh_path":"` + meshPath + `"}]}`)
}

func mustZip(t *testing.T, files map[string][]byte) []byte {
	t.Helper()
	data, err := zipFiles(files)
	test.That(t, err, test.ShouldBeNil)
	return data
}

func TestImportZipSpecSelection(t *testing.T) {
	tests := []struct {
		name     string
		files    map[string][]byte
		wantErr  error
		wantRoot string
		wantName string
	}{
		{
			name:     "shallowest wins",
			files:    map[string][]byte{SpecFileName: []byte(`{"name":"root"}`), "a/" + SpecFileName: []byte(`{"name":"nested"}`)},
			wantRoot: "", wantName: "root",
		},
		{
			name:     "single nested spec sets root",
			files:    map[string][]byte{"a/" + SpecFileName: []byte(`{"name":"nested"}`), "a/b/" + SpecFileName: []byte(`{"name":"deeper"}`)},
			wantRoot: "a", wantName: "nested",
		},
		{
			name:    "two at one depth is ambiguous",
			files:   map[string][]byte{"a/" + SpecFileName: []byte(`{}`), "b/" + SpecFileName: []byte(`{}`)},
			wantErr: errAmbiguousSpecInZip,
		},
		{
			name:    "no spec",
			files:   map[string][]byte{"cad/x.stl": []byte("x")},
			wantErr: errNoSpecInZip,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := importZip(mustZip(t, tc.files))
			if tc.wantErr != nil {
				test.That(t, err, test.ShouldBeError, tc.wantErr)
				return
			}
			test.That(t, err, test.ShouldBeNil)
			test.That(t, resp.GetRoot(), test.ShouldEqual, tc.wantRoot)
			test.That(t, resp.GetSpec().GetName(), test.ShouldEqual, tc.wantName)
		})
	}
}

func TestImportZipSources(t *testing.T) {
	resp, err := importZip(mustZip(t, map[string][]byte{
		SpecFileName: specJSON("cad/x.stl"),
	}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, resp.GetSources(), test.ShouldBeEmpty)
	test.That(t, resp.GetMissingSources(), test.ShouldResemble, []string{"cad/x.stl"})

	resp, err = importZip(mustZip(t, map[string][]byte{
		"m/" + SpecFileName: specJSON("cad/x.stl"),
		"m/cad/x.stl":       []byte("mesh"),
	}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, resp.GetRoot(), test.ShouldEqual, "m")
	test.That(t, string(resp.GetSources()["cad/x.stl"]), test.ShouldEqual, "mesh")
	test.That(t, resp.GetMissingSources(), test.ShouldBeEmpty)
}

func TestImportZipEscapingMeshIsMissing(t *testing.T) {
	resp, err := importZip(mustZip(t, map[string][]byte{
		"m/" + SpecFileName: specJSON("../escape.stl"),
		"escape.stl":        []byte("outside"),
	}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, resp.GetSources(), test.ShouldBeEmpty)
	test.That(t, resp.GetMissingSources(), test.ShouldResemble, []string{"../escape.stl"})
}

func TestImportZipMalformed(t *testing.T) {
	_, err := importZip([]byte("not a zip"))
	test.That(t, err, test.ShouldNotBeNil)
	_, err = importZip(mustZip(t, map[string][]byte{SpecFileName: []byte("{nope")}))
	test.That(t, err, test.ShouldNotBeNil)
}

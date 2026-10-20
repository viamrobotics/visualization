package kinematics

import (
	"archive/zip"
	"bytes"
	"io"
	"testing"

	"go.viam.com/test"
)

func readZip(t *testing.T, data []byte) map[string][]byte {
	t.Helper()
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	test.That(t, err, test.ShouldBeNil)
	got := map[string][]byte{}
	for _, f := range reader.File {
		rc, err := f.Open()
		test.That(t, err, test.ShouldBeNil)
		b, err := io.ReadAll(rc)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, rc.Close(), test.ShouldBeNil)
		got[f.Name] = b
	}
	return got
}

func TestZipFilesRoundTripAndDeterminism(t *testing.T) {
	files := map[string][]byte{"b/two.txt": []byte("two"), "a.txt": []byte("one"), "c.bin": bytes.Repeat([]byte{7}, 4096)}
	first, err := zipFiles(files)
	test.That(t, err, test.ShouldBeNil)
	second, err := zipFiles(files)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, bytes.Equal(first, second), test.ShouldBeTrue)

	got := readZip(t, first)
	test.That(t, len(got), test.ShouldEqual, len(files))
	for name, data := range files {
		test.That(t, bytes.Equal(got[name], data), test.ShouldBeTrue)
	}

	reader, err := zip.NewReader(bytes.NewReader(first), int64(len(first)))
	test.That(t, err, test.ShouldBeNil)
	var order []string
	for _, f := range reader.File {
		order = append(order, f.Name)
	}
	test.That(t, order, test.ShouldResemble, []string{"a.txt", "b/two.txt", "c.bin"})
}

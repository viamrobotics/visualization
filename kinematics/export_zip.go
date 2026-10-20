package kinematics

import (
	"archive/zip"
	"bytes"
	"fmt"
	"sort"
	"time"
)

// zipModified is the one modification time every entry carries, so output bytes are reproducible.
var zipModified = time.Date(2020, time.January, 1, 0, 0, 0, 0, time.UTC)

// zipFiles packs files into a zip archive, keyed by slash-separated path. Entries are sorted and
// carry a fixed modification time, so the same files always produce the same bytes.
func zipFiles(files map[string][]byte) ([]byte, error) {
	names := make([]string, 0, len(files))
	for name := range files {
		names = append(names, name)
	}
	sort.Strings(names)

	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)
	for _, name := range names {
		entry, err := writer.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Deflate, Modified: zipModified})
		if err != nil {
			return nil, fmt.Errorf("create zip entry %q: %w", name, err)
		}
		if _, err := entry.Write(files[name]); err != nil {
			return nil, fmt.Errorf("write zip entry %q: %w", name, err)
		}
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close zip: %w", err)
	}
	return buf.Bytes(), nil
}

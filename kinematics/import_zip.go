package kinematics

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"path"
	"sort"
	"strings"

	"google.golang.org/protobuf/encoding/protojson"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// errNoSpecInZip and errAmbiguousSpecInZip are the two zips importZip cannot read a project from.
var (
	errNoSpecInZip        = errors.New("zip holds no " + SpecFileName)
	errAmbiguousSpecInZip = errors.New("zip holds more than one " + SpecFileName + " at the shallowest depth")
)

// importZip finds the shallowest SpecFileName in a zip, parses it, and reads each link's mesh_path
// relative to the spec's directory. It is the inverse of an Export of either kind.
func importZip(data []byte) (*kinematicsv1.ImportResponse, error) {
	entries, err := zipEntries(data)
	if err != nil {
		return nil, err
	}

	specPath, err := shallowestSpecPath(entries)
	if err != nil {
		return nil, err
	}
	specBytes, err := readZipEntry(entries[specPath])
	if err != nil {
		return nil, err
	}
	spec := &kinematicsv1.KinematicsSpec{}
	if err := protojson.Unmarshal(specBytes, spec); err != nil {
		return nil, fmt.Errorf("parse %q: %w", specPath, err)
	}

	root := path.Dir(specPath)
	if root == "." {
		root = ""
	}
	resp := &kinematicsv1.ImportResponse{Spec: spec, Sources: map[string][]byte{}, Root: root}
	visited := map[string]bool{}
	for _, link := range spec.GetLinks() {
		meshPath := link.GetMeshPath()
		if visited[meshPath] {
			continue
		}
		visited[meshPath] = true
		file, found := entries[path.Join(root, meshPath)]
		if !found || !isWithinRoot(meshPath) {
			resp.MissingSources = append(resp.MissingSources, meshPath)
			continue
		}
		content, err := readZipEntry(file)
		if err != nil {
			return nil, err
		}
		resp.Sources[meshPath] = content
	}
	sort.Strings(resp.MissingSources)
	return resp, nil
}

// zipEntries opens a zip and returns its file entries by name, skipping directories.
func zipEntries(data []byte) (map[string]*zip.File, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}
	entries := make(map[string]*zip.File, len(reader.File))
	for _, file := range reader.File {
		if !file.FileInfo().IsDir() {
			entries[file.Name] = file
		}
	}
	return entries, nil
}

// readZipFiles reads every file entry of a zip into memory, keyed by name.
func readZipFiles(data []byte) (map[string][]byte, error) {
	entries, err := zipEntries(data)
	if err != nil {
		return nil, err
	}
	files := make(map[string][]byte, len(entries))
	for name, entry := range entries {
		content, err := readZipEntry(entry)
		if err != nil {
			return nil, err
		}
		files[name] = content
	}
	return files, nil
}

// shallowestSpecPath returns the entry named SpecFileName with the fewest path segments.
func shallowestSpecPath(entries map[string]*zip.File) (string, error) {
	best, bestDepth, count := "", 0, 0
	for name := range entries {
		if path.Base(name) != SpecFileName {
			continue
		}
		depth := strings.Count(name, "/")
		switch {
		case count == 0 || depth < bestDepth:
			best, bestDepth, count = name, depth, 1
		case depth == bestDepth:
			count++
		}
	}
	switch count {
	case 0:
		return "", errNoSpecInZip
	case 1:
		return best, nil
	default:
		return "", errAmbiguousSpecInZip
	}
}

// isWithinRoot reports whether meshPath, joined onto the spec directory, stays inside it.
func isWithinRoot(meshPath string) bool {
	if path.IsAbs(meshPath) {
		return false
	}
	cleaned := path.Clean(meshPath)
	return cleaned != ".." && !strings.HasPrefix(cleaned, "../")
}

func readZipEntry(file *zip.File) ([]byte, error) {
	rc, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("open zip entry %q: %w", file.Name, err)
	}
	content, err := io.ReadAll(rc)
	if err != nil {
		_ = rc.Close()
		return nil, fmt.Errorf("read zip entry %q: %w", file.Name, err)
	}
	// Close is where a zip entry reports a checksum mismatch, so it is an error, not cleanup.
	if err := rc.Close(); err != nil {
		return nil, fmt.Errorf("close zip entry %q: %w", file.Name, err)
	}
	return content, nil
}

package main

import (
	"archive/zip"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/viamrobotics/visualization/kinematics"
	"github.com/viamrobotics/visualization/kinematics/urdf"
)

// isVendorPath reports whether path names a URDF, a xacro file, a zip, or a directory without a spec, which
// build and import convert rather than read as a spec file.
func isVendorPath(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".urdf", ".xacro", ".zip":
		return true
	}
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return false
	}
	_, err = os.Stat(filepath.Join(path, kinematics.SpecFileName))
	return err != nil
}

// importVendor converts the URDF, xacro file, package directory, or zip at path.
func importVendor(path, tcpLink string) (*urdf.Import, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("read %q: %w", path, err)
	}
	opts := urdf.Options{TCPLink: tcpLink}
	var files fs.FS
	switch {
	case info.IsDir():
		files = os.DirFS(path)
	case strings.EqualFold(filepath.Ext(path), ".zip"):
		reader, err := zip.OpenReader(path)
		if err != nil {
			return nil, fmt.Errorf("open zip %q: %w", path, err)
		}
		defer func() { _ = reader.Close() }()
		files = reader
	default:
		absolute, err := filepath.Abs(path)
		if err != nil {
			return nil, fmt.Errorf("resolve %q: %w", path, err)
		}
		root := singleFileRoot(absolute)
		rel, err := filepath.Rel(root, absolute)
		if err != nil {
			return nil, fmt.Errorf("locate %q in %q: %w", path, root, err)
		}
		files = os.DirFS(root)
		opts.URDFPath = filepath.ToSlash(rel)
	}
	imported, err := urdf.Convert(files, opts)
	if err != nil {
		return nil, fmt.Errorf("import %q: %w", path, err)
	}
	return imported, nil
}

// singleFileRoot returns the nearest ancestor directory of the absolute file path that holds a
// package.xml, so a xacro file can reach its package's includes and meshes. Without one it returns
// the file's own directory.
func singleFileRoot(absolute string) string {
	for dir := filepath.Dir(absolute); ; dir = filepath.Dir(dir) {
		if info, err := os.Stat(filepath.Join(dir, "package.xml")); err == nil && !info.IsDir() {
			return dir
		}
		if dir == filepath.Dir(dir) {
			return filepath.Dir(absolute)
		}
	}
}

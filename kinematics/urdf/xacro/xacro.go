// Package xacro expands the subset of xacro that ROS robot descriptions use into plain URDF, with no
// ROS install: properties, args, macros with default and block params, includes, conditionals, and
// `${}` expressions. A feature outside the subset fails with an UnsupportedError, never a partial
// document.
package xacro

import (
	"fmt"
	"io/fs"
	"path"
	"strings"
)

// Options adjusts an expansion.
type Options struct {
	// Args overrides `<xacro:arg>` defaults by name.
	Args map[string]string
	// FindPackage returns the directory of the ROS package that `$(find name)` names, rooted at the
	// expanded files with a leading `/`, such as `/robotiq_description`. `$(find)` writes it verbatim,
	// and an include path that starts with `/` resolves from the root of the files. Nil fails every
	// `$(find)`.
	FindPackage func(name string) (string, error)
}

// UnsupportedError reports a xacro feature outside the subset.
type UnsupportedError struct {
	// Feature names the construct, such as `xacro.load_yaml` or `$(env)`.
	Feature string
	// File is the xacro file that uses it, relative to the root of the expanded files.
	File string
	// Entry is the file the expansion started from, which the external command expands.
	Entry string
}

func (err *UnsupportedError) Error() string {
	return fmt.Sprintf("%s in %s is not supported. Expand it with `%s` where ROS is installed, then import the .urdf",
		err.Feature, err.File, Command(err.Entry))
}

// Command is the external command that expands the xacro file at name to plain URDF beside it.
func Command(name string) string {
	base := strings.TrimSuffix(path.Base(name), path.Ext(name))
	base = strings.TrimSuffix(base, ".urdf")
	return fmt.Sprintf("xacro %s -o %s.urdf", name, base)
}

// Expand reads the xacro document at name in files and returns it as plain URDF: the `<robot>` root
// with every xacro element expanded and the xacro namespace removed.
func Expand(files fs.FS, name string, opts Options) ([]byte, error) {
	e := &expander{files: files, entry: cleanName(name), opts: opts, args: map[string]string{}}
	return e.run()
}

package xacro

import (
	"fmt"
	"io/fs"
	"path"
	"strings"
)

// include expands `<xacro:include filename=...>`, splicing the included root's children in place.
// The file's definitions land in sc, as xacro's do.
func (e *expander) include(n *tree, sc *scope, file string) ([]*tree, error) {
	for _, a := range n.attrs {
		if a.name != "filename" {
			return nil, e.unsupportedAt("xacro:include "+a.name, file)
		}
	}
	raw, ok := n.attr("filename")
	if !ok {
		return nil, fmt.Errorf("%s: xacro:include has no filename", file)
	}
	filename, err := e.text(raw, sc, file)
	if err != nil {
		return nil, err
	}
	target := resolveInclude(file, filename)
	for _, open := range e.stack {
		if open == target {
			return nil, fmt.Errorf("%s: include cycle: %s -> %s", file, strings.Join(e.stack, " -> "), target)
		}
	}
	data, err := fs.ReadFile(e.files, target)
	if err != nil {
		return nil, fmt.Errorf("%s: including %s: %w", file, filename, err)
	}
	root, err := parseDocument(data)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", target, err)
	}
	e.stack = append(e.stack, target)
	defer func() { e.stack = e.stack[:len(e.stack)-1] }()
	return e.expandNodes(root.children, sc, target)
}

// resolveInclude maps an include's filename to a path in the file system: a leading `/` is the root
// of the files, anything else is relative to the including file's directory.
func resolveInclude(from, filename string) string {
	if strings.HasPrefix(filename, "/") {
		return path.Clean(strings.TrimLeft(filename, "/"))
	}
	return path.Join(path.Dir(from), filename)
}

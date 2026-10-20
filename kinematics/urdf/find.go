package urdf

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"path"
	"strings"
)

// xacroDefinitions are the root children that define things and emit no robot parts.
var xacroDefinitions = map[string]bool{"property": true, "arg": true, "macro": true, "include": true}

// FindURDF returns the path of the only `.urdf` file in files. With none, it returns the only
// `.xacro` entry file: one that no other `.xacro` in files includes and whose root holds more than
// definitions. It fails when there are none or several, naming the candidates.
func FindURDF(files fs.FS) (string, error) {
	var urdfs, xacros []string
	err := fs.WalkDir(files, ".", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		switch strings.ToLower(path.Ext(name)) {
		case ".urdf":
			urdfs = append(urdfs, name)
		case ".xacro":
			xacros = append(xacros, name)
		}
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("search for a URDF: %w", err)
	}
	switch {
	case len(urdfs) == 1:
		return urdfs[0], nil
	case len(urdfs) > 1:
		return "", fmt.Errorf("found %d URDF files, pick one: %s", len(urdfs), strings.Join(urdfs, ", "))
	case len(xacros) > 0:
		return findXacroEntry(files, xacros)
	}
	return "", errors.New("no .urdf or .xacro file found")
}

// findXacroEntry picks the entry among xacros.
func findXacroEntry(files fs.FS, xacros []string) (string, error) {
	summaries := make(map[string]xacroSummary, len(xacros))
	included := map[string]bool{}
	for _, name := range xacros {
		data, err := fs.ReadFile(files, name)
		if err != nil {
			return "", fmt.Errorf("read %q: %w", name, err)
		}
		summary := summarizeXacro(data)
		summaries[name] = summary
		for _, base := range summary.includes {
			included[base] = true
		}
	}
	var entries []string
	for _, name := range xacros {
		if summaries[name].hasContent && !included[path.Base(name)] {
			entries = append(entries, name)
		}
	}
	switch len(entries) {
	case 1:
		return entries[0], nil
	case 0:
		return "", fmt.Errorf("found .xacro files but no entry file: %s", strings.Join(xacros, ", "))
	}
	return "", fmt.Errorf("found %d xacro entry files, pick one: %s", len(entries), strings.Join(entries, ", "))
}

// xacroSummary is what entry detection reads of a xacro file.
type xacroSummary struct {
	// includes holds the base name of every `xacro:include` filename.
	includes []string
	// hasContent reports a root child besides property, arg, macro, and include. A file that does
	// not parse counts, so the expansion reports its error.
	hasContent bool
}

func summarizeXacro(data []byte) xacroSummary {
	var summary xacroSummary
	decoder := xml.NewDecoder(bytes.NewReader(data))
	depth := 0
	for {
		token, err := decoder.Token()
		if err != nil {
			summary.hasContent = summary.hasContent || !errors.Is(err, io.EOF)
			return summary
		}
		switch typed := token.(type) {
		case xml.StartElement:
			depth++
			if depth != 2 {
				continue
			}
			if !strings.HasSuffix(typed.Name.Space, "xacro") || !xacroDefinitions[typed.Name.Local] {
				summary.hasContent = true
				continue
			}
			if typed.Name.Local == "include" {
				for _, attr := range typed.Attr {
					if attr.Name.Local == "filename" {
						summary.includes = append(summary.includes, path.Base(attr.Value))
					}
				}
			}
		case xml.EndElement:
			depth--
		}
	}
}

package xacro

import (
	"errors"
	"fmt"
	"io/fs"
	"path"
	"strings"
)

// expander holds the state of one Expand call.
type expander struct {
	files fs.FS
	entry string
	opts  Options
	// args holds the declared `<xacro:arg>` values: the default, or the override from opts.Args.
	args map[string]string
	// stack is the chain of files being included, which detects a cycle.
	stack []string
	// pending is the error from a property that failed inside a lookup.
	pending error
}

func (e *expander) run() ([]byte, error) {
	data, err := fs.ReadFile(e.files, e.entry)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", e.entry, err)
	}
	root, err := parseDocument(data)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", e.entry, err)
	}
	e.stack = []string{e.entry}
	out, err := e.expandNode(root, newScope(nil), e.entry)
	if err != nil {
		return nil, err
	}
	if len(out) != 1 || out[0].text {
		return nil, fmt.Errorf("%s: root element expanded to %d nodes, want one", e.entry, len(out))
	}
	return serialize(out[0]), nil
}

func (e *expander) expandNodes(nodes []*tree, sc *scope, file string) ([]*tree, error) {
	var out []*tree
	for _, n := range nodes {
		expanded, err := e.expandNode(n, sc, file)
		if err != nil {
			return nil, err
		}
		out = append(out, expanded...)
	}
	return out, nil
}

func (e *expander) expandNode(n *tree, sc *scope, file string) ([]*tree, error) {
	if n.text {
		text, err := e.text(n.value, sc, file)
		if err != nil {
			return nil, err
		}
		return []*tree{{text: true, value: text}}, nil
	}
	if n.xacro {
		return e.expandXacro(n, sc, file)
	}
	elem := &tree{name: n.name}
	for _, a := range n.attrs {
		text, err := e.text(a.value, sc, file)
		if err != nil {
			return nil, err
		}
		elem.attrs = append(elem.attrs, attribute{name: a.name, value: text})
	}
	children, err := e.expandNodes(n.children, sc, file)
	if err != nil {
		return nil, err
	}
	elem.children = children
	return []*tree{elem}, nil
}

func (e *expander) expandXacro(n *tree, sc *scope, file string) ([]*tree, error) {
	switch n.name {
	case "property":
		return nil, e.property(n, sc, file)
	case "arg":
		return nil, e.arg(n, sc, file)
	case "macro":
		return nil, e.define(n, sc, file)
	case "include":
		return e.include(n, sc, file)
	case "insert_block":
		return e.insertBlock(n, sc, file)
	case "if", "unless":
		return e.conditional(n, sc, file)
	case "element", "attribute", "call":
		return nil, e.unsupportedAt("xacro:"+n.name, file)
	}
	return e.call(n, sc, file)
}

func (e *expander) property(n *tree, sc *scope, file string) error {
	if _, ok := n.attr("scope"); ok {
		return e.unsupportedAt("xacro:property scope", file)
	}
	raw, ok := n.attr("name")
	if !ok {
		return fmt.Errorf("%s: xacro:property has no name", file)
	}
	name, err := e.text(raw, sc, file)
	if err != nil {
		return err
	}
	text, hasValue := n.attr("value")
	if !hasValue {
		sc.blocks[name] = n.children
		return nil
	}
	p := &property{raw: text, owner: sc, file: file}
	sc.props[name] = p
	if lazy, _ := n.attr("lazy_eval"); lazy == "false" {
		_, err := e.resolve(name, p)
		return err
	}
	return nil
}

// arg declares an arg. A name in opts.Args overrides the default, and an arg with neither stays
// undefined, which fails only if something reads it.
func (e *expander) arg(n *tree, sc *scope, file string) error {
	name, ok := n.attr("name")
	if !ok {
		return fmt.Errorf("%s: xacro:arg has no name", file)
	}
	if override, ok := e.opts.Args[name]; ok {
		e.args[name] = override
		return nil
	}
	if fallback, ok := n.attr("default"); ok {
		text, err := e.text(fallback, sc, file)
		if err != nil {
			return err
		}
		e.args[name] = text
	}
	return nil
}

func (e *expander) insertBlock(n *tree, sc *scope, file string) ([]*tree, error) {
	raw, ok := n.attr("name")
	if !ok {
		return nil, fmt.Errorf("%s: xacro:insert_block has no name", file)
	}
	name, err := e.text(raw, sc, file)
	if err != nil {
		return nil, err
	}
	block, ok := sc.block(name)
	if !ok {
		return nil, fmt.Errorf("%s: xacro:insert_block: no block named %q", file, name)
	}
	return e.expandNodes(block, sc, file)
}

func (e *expander) conditional(n *tree, sc *scope, file string) ([]*tree, error) {
	raw, ok := n.attr("value")
	if !ok {
		return nil, fmt.Errorf("%s: xacro:%s has no value", file, n.name)
	}
	v, err := e.typed(raw, sc, file)
	if err != nil {
		return nil, err
	}
	holds, err := condition(v)
	if err != nil {
		return nil, fmt.Errorf("%s: xacro:%s: %w", file, n.name, err)
	}
	if holds != (n.name == "if") {
		return nil, nil
	}
	return e.expandNodes(n.children, sc, file)
}

// directive resolves `$(find pkg)` and `$(arg name)`. Every other directive is outside the subset.
func (e *expander) directive(name string, args []string) (string, error) {
	switch name {
	case "find":
		if len(args) != 1 {
			return "", errors.New("$(find) takes one package name")
		}
		if e.opts.FindPackage == nil {
			return "", fmt.Errorf("$(find %s): no package lookup", args[0])
		}
		dir, err := e.opts.FindPackage(args[0])
		if err != nil {
			return "", fmt.Errorf("$(find %s): %w", args[0], err)
		}
		return dir, nil
	case "arg":
		if len(args) != 1 {
			return "", errors.New("$(arg) takes one arg name")
		}
		v, ok := e.args[args[0]]
		if !ok {
			return "", fmt.Errorf("$(arg %s): arg is not defined", args[0])
		}
		return v, nil
	}
	return "", unsupported("$(" + name + ")")
}

// text interpolates document text in sc.
func (e *expander) text(s string, sc *scope, file string) (string, error) {
	e.pending = nil
	out, err := interpolate(s, e.names(sc), e.directive)
	return out, e.fail(err, file)
}

// typed interpolates a property value or macro argument, keeping a lone `${expr}` typed.
func (e *expander) typed(s string, sc *scope, file string) (value, error) {
	e.pending = nil
	v, err := interpolateValue(s, e.names(sc), e.directive)
	return v, e.fail(err, file)
}

// fail reports err with the file it happened in. An error from a failed property lookup was
// already located, and replaces the evaluator's "unknown name".
func (e *expander) fail(err error, file string) error {
	if err == nil {
		return nil
	}
	if e.pending != nil {
		err, e.pending = e.pending, nil
		return err
	}
	var unsup *UnsupportedError
	if errors.As(err, &unsup) {
		if unsup.File == "" {
			unsup.File, unsup.Entry = file, e.entry
		}
		// The wrapping text was formatted before File was known, so return the error itself.
		return unsup
	}
	return fmt.Errorf("%s: %w", file, err)
}

func (e *expander) unsupportedAt(feature, file string) error {
	return &UnsupportedError{Feature: feature, File: file, Entry: e.entry}
}

// cleanName turns a name in files into the unrooted form fs.FS takes.
func cleanName(name string) string {
	return path.Clean(strings.TrimLeft(name, "/"))
}

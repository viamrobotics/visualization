package xacro

import (
	"fmt"
	"strings"
)

type paramKind int

const (
	valueParam paramKind = iota
	// blockParam (`*name`) takes one child element of the call, and inserts that element.
	blockParam
	// groupParam (`**name`) takes one child element of the call, and inserts its children.
	groupParam
)

type param struct {
	name string
	kind paramKind
	// forward marks `:=^`, which reads the name from the caller's scope.
	forward    bool
	hasDefault bool
	fallback   string
}

type macro struct {
	name   string
	params []param
	body   []*tree
	// file is where the macro is defined, which resolves the relative includes in its body.
	file string
}

// parseParams reads a macro's `params` attribute: `name`, `name:=default`, `name:=^`,
// `name:=^|default`, `*block`, and `**block`.
func parseParams(spec string) ([]param, error) {
	var params []param
	for _, field := range splitParams(spec) {
		switch {
		case strings.HasPrefix(field, "**"):
			params = append(params, param{name: field[2:], kind: groupParam})
		case strings.HasPrefix(field, "*"):
			params = append(params, param{name: field[1:], kind: blockParam})
		default:
			name, fallback, hasDefault := strings.Cut(field, ":=")
			p := param{name: name, hasDefault: hasDefault, fallback: fallback}
			if hasDefault && strings.HasPrefix(fallback, "^") {
				p.forward = true
				p.fallback, p.hasDefault = strings.CutPrefix(fallback[1:], "|")
			}
			params = append(params, p)
		}
		if params[len(params)-1].name == "" {
			return nil, fmt.Errorf("macro param %q has no name", field)
		}
	}
	return params, nil
}

// define records a `<xacro:macro>` in sc. Its body stays unexpanded until a call.
func (e *expander) define(def *tree, sc *scope, file string) error {
	name, ok := def.attr("name")
	if !ok {
		return fmt.Errorf("%s: xacro:macro has no name", file)
	}
	spec, _ := def.attr("params")
	params, err := parseParams(spec)
	if err != nil {
		return fmt.Errorf("%s: macro %s: %w", file, name, err)
	}
	sc.macros[name] = &macro{name: name, params: params, body: def.children, file: file}
	return nil
}

// call expands `<xacro:name ...>`: attributes are evaluated in the caller's scope, block params come
// from the call's child elements in order, and the body runs in a fresh child scope.
func (e *expander) call(call *tree, sc *scope, file string) ([]*tree, error) {
	m := sc.macro(call.name)
	if m == nil {
		return nil, fmt.Errorf("%s: undefined macro %q (xacro:%s)", file, call.name, call.name)
	}
	local := newScope(sc)
	blocks := call.elements()
	known := map[string]bool{}
	for _, p := range m.params {
		known[p.name] = true
		if p.kind == valueParam {
			v, err := e.paramValue(call, p, sc, file)
			if err != nil {
				return nil, fmt.Errorf("%s: macro %s: %w", file, m.name, err)
			}
			local.props[p.name] = &property{val: v, done: true}
			continue
		}
		if len(blocks) == 0 {
			return nil, fmt.Errorf("%s: macro %s: missing block %q", file, m.name, p.name)
		}
		block := blocks[0]
		blocks = blocks[1:]
		if p.kind == blockParam {
			local.blocks[p.name] = []*tree{block}
		} else {
			local.blocks[p.name] = block.children
		}
	}
	for _, a := range call.attrs {
		if !known[a.name] {
			return nil, fmt.Errorf("%s: macro %s has no param %q", file, m.name, a.name)
		}
	}
	if len(blocks) > 0 {
		return nil, fmt.Errorf("%s: macro %s: unused block %q", file, m.name, blocks[0].name)
	}
	return e.expandNodes(m.body, local, m.file)
}

func (e *expander) paramValue(call *tree, p param, caller *scope, file string) (value, error) {
	if text, ok := call.attr(p.name); ok {
		return e.typed(text, caller, file)
	}
	if p.forward {
		e.pending = nil
		if v, ok := e.names(caller)(p.name); ok {
			return v, nil
		}
		if e.pending != nil {
			err := e.pending
			e.pending = nil
			return nil, err
		}
	}
	if p.hasDefault {
		return e.typed(p.fallback, caller, file)
	}
	return nil, fmt.Errorf("missing param %q", p.name)
}

// splitParams splits a `params` attribute on whitespace outside `${}` and `$()`, so a default such as
// `${0.5 / 10}` stays one param.
func splitParams(spec string) []string {
	var fields []string
	depth, start := 0, -1
	for i, char := range spec {
		switch {
		case char == '{' || char == '(':
			depth++
		case char == '}' || char == ')':
			depth--
		}
		space := depth <= 0 && strings.ContainsRune(" \t\r\n", char)
		switch {
		case space && start >= 0:
			fields = append(fields, spec[start:i])
			start = -1
		case !space && start < 0:
			start = i
		}
	}
	if start >= 0 {
		fields = append(fields, spec[start:])
	}
	return fields
}

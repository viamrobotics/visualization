package xacro

import "fmt"

// property is a named value. A `value` property is evaluated on first use, the way xacro 2 does, so
// it may name a property defined after it. A macro param is stored already evaluated.
type property struct {
	raw   string
	owner *scope
	file  string

	val   value
	done  bool
	busy  bool
	cause error
}

// scope holds the properties, macros, and blocks visible at one point. A macro call opens a child of
// the caller's scope, so its body sees the caller's names and its own definitions stay local.
type scope struct {
	parent *scope
	props  map[string]*property
	macros map[string]*macro
	blocks map[string][]*tree
}

func newScope(parent *scope) *scope {
	return &scope{
		parent: parent,
		props:  map[string]*property{},
		macros: map[string]*macro{},
		blocks: map[string][]*tree{},
	}
}

func (s *scope) property(name string) *property {
	for cur := s; cur != nil; cur = cur.parent {
		if p, ok := cur.props[name]; ok {
			return p
		}
	}
	return nil
}

func (s *scope) macro(name string) *macro {
	for cur := s; cur != nil; cur = cur.parent {
		if m, ok := cur.macros[name]; ok {
			return m
		}
	}
	return nil
}

func (s *scope) block(name string) ([]*tree, bool) {
	for cur := s; cur != nil; cur = cur.parent {
		if b, ok := cur.blocks[name]; ok {
			return b, true
		}
	}
	return nil, false
}

// names returns the evaluator's lookup for sc. The lookup cannot return an error, so a failure while
// evaluating a property is left in e.pending for the caller to report instead of "unknown name".
func (e *expander) names(sc *scope) lookup {
	return func(name string) (value, bool) {
		p := sc.property(name)
		if p == nil {
			return nil, false
		}
		v, err := e.resolve(name, p)
		if err != nil {
			e.pending = err
			return nil, false
		}
		return v, true
	}
}

func (e *expander) resolve(name string, p *property) (value, error) {
	if p.done {
		return p.val, p.cause
	}
	if p.busy {
		return nil, fmt.Errorf("circular variable definition: %s", name)
	}
	p.busy = true
	v, err := e.typed(p.raw, p.owner, p.file)
	p.busy = false
	p.val, p.done, p.cause = v, true, err
	return v, err
}

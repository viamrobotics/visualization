package xacro

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"strings"
)

// tree is one element or text run of a document. Expansion reads one tree and builds another of the
// same shape, which the serializer writes.
type tree struct {
	// text marks a character-data node, whose content is in value.
	text bool
	// xacro marks an element in the xacro namespace.
	xacro bool
	name  string
	// value is the character data of a text node.
	value    string
	attrs    []attribute
	children []*tree
}

type attribute struct {
	name, value string
}

// attr returns the value of the named attribute.
func (n *tree) attr(name string) (string, bool) {
	for _, a := range n.attrs {
		if a.name == name {
			return a.value, true
		}
	}
	return "", false
}

// elements returns the child elements, skipping text.
func (n *tree) elements() []*tree {
	var out []*tree
	for _, child := range n.children {
		if !child.text {
			out = append(out, child)
		}
	}
	return out
}

// isXacroSpace reports whether an element namespace is xacro's. The decoder leaves an undeclared
// prefix in place of the URI, so the prefix `xacro` counts too, as does either documented URI.
func isXacroSpace(space string) bool {
	return strings.HasSuffix(space, "xacro")
}

// parseDocument reads data into a node tree. Comments, processing instructions, and `xmlns`
// declarations are dropped, since the output carries none of them.
func parseDocument(data []byte) (*tree, error) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	var stack []*tree
	var root *tree
	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, err
		}
		switch typed := token.(type) {
		case xml.StartElement:
			elem := &tree{name: typed.Name.Local, xacro: isXacroSpace(typed.Name.Space)}
			for _, a := range typed.Attr {
				if a.Name.Space == "xmlns" || (a.Name.Space == "" && a.Name.Local == "xmlns") {
					continue
				}
				elem.attrs = append(elem.attrs, attribute{name: a.Name.Local, value: a.Value})
			}
			if len(stack) == 0 {
				if root != nil {
					return nil, errors.New("more than one root element")
				}
				root = elem
			} else {
				parent := stack[len(stack)-1]
				parent.children = append(parent.children, elem)
			}
			stack = append(stack, elem)
		case xml.EndElement:
			stack = stack[:len(stack)-1]
		case xml.CharData:
			if len(stack) > 0 {
				parent := stack[len(stack)-1]
				parent.children = append(parent.children, &tree{text: true, value: string(typed)})
			}
		}
	}
	if root == nil {
		return nil, fmt.Errorf("no root element")
	}
	return root, nil
}

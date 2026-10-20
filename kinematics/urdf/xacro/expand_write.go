package xacro

import (
	"bytes"
	"encoding/xml"
)

// serialize writes root as a standalone document. It does its own escaping instead of using
// xml.Encoder, which would re-derive namespace declarations the output must not have.
func serialize(root *tree) []byte {
	var out bytes.Buffer
	out.WriteString("<?xml version=\"1.0\"?>\n")
	writeNode(&out, root)
	out.WriteByte('\n')
	return out.Bytes()
}

func writeNode(out *bytes.Buffer, n *tree) {
	if n.text {
		_ = xml.EscapeText(out, []byte(n.value))
		return
	}
	out.WriteByte('<')
	out.WriteString(n.name)
	for _, a := range n.attrs {
		out.WriteByte(' ')
		out.WriteString(a.name)
		out.WriteString(`="`)
		_ = xml.EscapeText(out, []byte(a.value))
		out.WriteByte('"')
	}
	if len(n.children) == 0 {
		out.WriteString("/>")
		return
	}
	out.WriteByte('>')
	for _, child := range n.children {
		writeNode(out, child)
	}
	out.WriteString("</")
	out.WriteString(n.name)
	out.WriteByte('>')
}

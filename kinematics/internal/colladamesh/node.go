package colladamesh

import (
	"encoding/xml"
	"fmt"
)

type node struct {
	ID string
	// local is the node's transform elements composed in document order.
	local        matrix
	geometryURLs []string
	nodeURLs     []string
	children     []node
}

type instanceReference struct {
	URL string `xml:"url,attr"`
}

func (n *node) UnmarshalXML(decoder *xml.Decoder, start xml.StartElement) error {
	n.local = identity()
	for _, attribute := range start.Attr {
		if attribute.Name.Local == "id" {
			n.ID = attribute.Value
		}
	}

	for {
		token, err := decoder.Token()
		if err != nil {
			return err
		}
		switch element := token.(type) {
		case xml.EndElement:
			return nil
		case xml.StartElement:
			if err := n.decodeChild(decoder, element); err != nil {
				return err
			}
		}
	}
}

func (n *node) decodeChild(decoder *xml.Decoder, element xml.StartElement) error {
	switch element.Name.Local {
	case "matrix", "translate", "rotate", "scale":
		var text string
		if err := decoder.DecodeElement(&text, &element); err != nil {
			return err
		}
		transform, err := elementMatrix(element.Name.Local, text, n.ID)
		if err != nil {
			return err
		}
		n.local = n.local.times(transform)
		return nil
	case "lookat", "skew":
		return fmt.Errorf("colladamesh: <node id=%q> uses <%s>, which is not supported", n.ID, element.Name.Local)
	case "instance_geometry":
		var instance instanceReference
		if err := decoder.DecodeElement(&instance, &element); err != nil {
			return err
		}
		n.geometryURLs = append(n.geometryURLs, instance.URL)
		return nil
	case "instance_node":
		var instance instanceReference
		if err := decoder.DecodeElement(&instance, &element); err != nil {
			return err
		}
		n.nodeURLs = append(n.nodeURLs, instance.URL)
		return nil
	case "node":
		var child node
		if err := decoder.DecodeElement(&child, &element); err != nil {
			return err
		}
		n.children = append(n.children, child)
		return nil
	}
	return decoder.Skip()
}

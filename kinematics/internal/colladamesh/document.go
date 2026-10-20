package colladamesh

import (
	"fmt"
	"strconv"
	"strings"
)

type document struct {
	Asset struct {
		Unit *struct {
			Meter string `xml:"meter,attr"`
		} `xml:"unit"`
	} `xml:"asset"`
	Geometries   []geometry    `xml:"library_geometries>geometry"`
	LibraryNodes []node        `xml:"library_nodes>node"`
	VisualScenes []visualScene `xml:"library_visual_scenes>visual_scene"`
	Scene        struct {
		VisualScene *struct {
			URL string `xml:"url,attr"`
		} `xml:"instance_visual_scene"`
	} `xml:"scene"`
}

type visualScene struct {
	ID    string `xml:"id,attr"`
	Nodes []node `xml:"node"`
}

type geometry struct {
	ID   string `xml:"id,attr"`
	Mesh *mesh  `xml:"mesh"`
}

type mesh struct {
	Sources   []source    `xml:"source"`
	Vertices  []vertices  `xml:"vertices"`
	Triangles []primitive `xml:"triangles"`
	Polylists []primitive `xml:"polylist"`
	Polygons  []primitive `xml:"polygons"`
	Tristrips []struct{}  `xml:"tristrips"`
	Trifans   []struct{}  `xml:"trifans"`
}

type source struct {
	ID         string `xml:"id,attr"`
	FloatArray *struct {
		ID   string `xml:"id,attr"`
		Text string `xml:",chardata"`
	} `xml:"float_array"`
	Accessor *struct {
		Count  string `xml:"count,attr"`
		Offset string `xml:"offset,attr"`
		Source string `xml:"source,attr"`
		Stride string `xml:"stride,attr"`
	} `xml:"technique_common>accessor"`
}

type vertices struct {
	ID     string  `xml:"id,attr"`
	Inputs []input `xml:"input"`
}

type input struct {
	Offset   string `xml:"offset,attr"`
	Semantic string `xml:"semantic,attr"`
	Source   string `xml:"source,attr"`
}

type primitive struct {
	Inputs []input  `xml:"input"`
	VCount string   `xml:"vcount"`
	P      []string `xml:"p"`
}

func (doc *document) unitMeters() (float64, error) {
	if doc.Asset.Unit == nil || strings.TrimSpace(doc.Asset.Unit.Meter) == "" {
		return 1, nil
	}
	meters, err := strconv.ParseFloat(strings.TrimSpace(doc.Asset.Unit.Meter), 64)
	if err != nil || meters <= 0 {
		return 0, fmt.Errorf("colladamesh: <unit meter=%q> must be a positive number", doc.Asset.Unit.Meter)
	}
	return meters, nil
}

func referencedID(url string) string {
	return strings.TrimPrefix(strings.TrimSpace(url), "#")
}

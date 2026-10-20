package colladamesh

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/golang/geo/r3"
)

const coordinatesPerPosition = 3

func (m *mesh) positionSource(verticesID string) (*source, error) {
	for i := range m.Vertices {
		if m.Vertices[i].ID != verticesID {
			continue
		}
		for _, in := range m.Vertices[i].Inputs {
			if in.Semantic != "POSITION" {
				continue
			}
			return m.sourceByID(referencedID(in.Source), verticesID)
		}
		return nil, fmt.Errorf("colladamesh: <vertices id=%q> has no POSITION input", verticesID)
	}
	return nil, fmt.Errorf("colladamesh: unresolved <vertices> %q", verticesID)
}

func (m *mesh) sourceByID(id, referrer string) (*source, error) {
	for i := range m.Sources {
		if m.Sources[i].ID == id {
			return &m.Sources[i], nil
		}
	}
	return nil, fmt.Errorf("colladamesh: %q references unresolved <source> %q", referrer, id)
}

// positions reads the X, Y, Z of every accessor element of s, which are the first three params.
func (s *source) positions() ([]r3.Vector, error) {
	if s.FloatArray == nil {
		return nil, fmt.Errorf("colladamesh: <source id=%q> has no <float_array>", s.ID)
	}
	fields := strings.Fields(s.FloatArray.Text)
	values := make([]float64, len(fields))
	for i, field := range fields {
		value, err := strconv.ParseFloat(field, 64)
		if err != nil {
			return nil, fmt.Errorf("colladamesh: <float_array id=%q> has malformed float %q", s.FloatArray.ID, field)
		}
		values[i] = value
	}

	count, offset, stride := len(values)/coordinatesPerPosition, 0, coordinatesPerPosition
	if s.Accessor != nil {
		var err error
		if count, err = attributeInt(s.Accessor.Count, count, "count", s.ID); err != nil {
			return nil, err
		}
		if offset, err = attributeInt(s.Accessor.Offset, 0, "offset", s.ID); err != nil {
			return nil, err
		}
		if stride, err = attributeInt(s.Accessor.Stride, 1, "stride", s.ID); err != nil {
			return nil, err
		}
	}
	if stride < coordinatesPerPosition {
		return nil, fmt.Errorf("colladamesh: <accessor> of <source id=%q> has stride %d, need at least 3 for X, Y, Z", s.ID, stride)
	}
	if count < 0 || offset < 0 || (count > 0 && offset+(count-1)*stride+coordinatesPerPosition > len(values)) {
		return nil, fmt.Errorf("colladamesh: <accessor> of <source id=%q> reads past its %d floats", s.ID, len(values))
	}

	positions := make([]r3.Vector, count)
	for i := range positions {
		base := offset + i*stride
		positions[i] = r3.Vector{X: values[base], Y: values[base+1], Z: values[base+2]}
	}
	return positions, nil
}

func attributeInt(text string, fallback int, name, sourceID string) (int, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(text)
	if err != nil {
		return 0, fmt.Errorf("colladamesh: <accessor> of <source id=%q> has malformed %s %q", sourceID, name, text)
	}
	return value, nil
}

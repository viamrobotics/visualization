package xacro

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"math"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// numericTolerance is how far apart two numeric tokens may be and still match.
const numericTolerance = 1e-9

// canonElement is a document reduced to what xacro output means: names, attributes without their
// order, and text without surrounding whitespace.
type canonElement struct {
	name     string
	attrs    map[string]string
	text     string
	children []*canonElement
}

func canonicalize(t *testing.T, data []byte) *canonElement {
	t.Helper()
	decoder := xml.NewDecoder(bytes.NewReader(data))
	var stack []*canonElement
	var root *canonElement
	var text []*strings.Builder
	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatalf("parsing %q: %v", data, err)
		}
		switch typed := token.(type) {
		case xml.StartElement:
			elem := &canonElement{name: typed.Name.Local, attrs: map[string]string{}}
			for _, a := range typed.Attr {
				elem.attrs[a.Name.Local] = a.Value
			}
			if len(stack) == 0 {
				root = elem
			} else {
				parent := stack[len(stack)-1]
				parent.children = append(parent.children, elem)
			}
			stack = append(stack, elem)
			text = append(text, &strings.Builder{})
		case xml.EndElement:
			top := len(stack) - 1
			stack[top].text = strings.TrimSpace(text[top].String())
			stack, text = stack[:top], text[:top]
		case xml.CharData:
			if len(stack) > 0 {
				text[len(text)-1].Write(typed)
			}
		}
	}
	return root
}

// diff describes the first difference between two canonical documents, or returns "" when they match.
func (a *canonElement) diff(b *canonElement, path string) string {
	path += "/" + a.name
	if a.name != b.name {
		return fmt.Sprintf("%s: element %q, want %q", path, a.name, b.name)
	}
	if !tokensMatch(a.text, b.text) {
		return fmt.Sprintf("%s: text %q, want %q", path, a.text, b.text)
	}
	if len(a.attrs) != len(b.attrs) {
		return fmt.Sprintf("%s: attributes %v, want %v", path, sortedAttrs(a.attrs), sortedAttrs(b.attrs))
	}
	for name, got := range a.attrs {
		want, ok := b.attrs[name]
		if !ok || !tokensMatch(got, want) {
			return fmt.Sprintf("%s: attribute %s=%q, want %q", path, name, got, want)
		}
	}
	if len(a.children) != len(b.children) {
		return fmt.Sprintf("%s: %d children, want %d", path, len(a.children), len(b.children))
	}
	for i := range a.children {
		if found := a.children[i].diff(b.children[i], path); found != "" {
			return found
		}
	}
	return ""
}

func sortedAttrs(attrs map[string]string) []string {
	out := make([]string, 0, len(attrs))
	for name, value := range attrs {
		out = append(out, name+"="+value)
	}
	sort.Strings(out)
	return out
}

// tokensMatch compares whitespace-separated tokens, numbers within numericTolerance and the rest exactly.
func tokensMatch(got, want string) bool {
	gotTokens, wantTokens := strings.Fields(got), strings.Fields(want)
	if len(gotTokens) != len(wantTokens) {
		return false
	}
	for i := range gotTokens {
		if gotTokens[i] == wantTokens[i] {
			continue
		}
		gotNumber, gotErr := strconv.ParseFloat(gotTokens[i], 64)
		wantNumber, wantErr := strconv.ParseFloat(wantTokens[i], 64)
		if gotErr != nil || wantErr != nil || math.Abs(gotNumber-wantNumber) > numericTolerance {
			return false
		}
	}
	return true
}

func TestCanonicalizer(t *testing.T) {
	tests := []struct {
		name     string
		got      string
		want     string
		expected bool
	}{
		{"ignores attribute order and whitespace", `<a x="1" y="2"><b/></a>`, "<a y=\"2\" x=\"1\">\n  <b/>\n</a>", true},
		{"ignores comments", `<a><!-- c --><b/></a>`, `<a><b/></a>`, true},
		{"integral float matches integer", `<a v="2"/>`, `<a v="2.0"/>`, true},
		{"numbers within tolerance match", `<a v="0.1 0.30000000000000004"/>`, `<a v="0.1 0.3"/>`, true},
		{"numbers outside tolerance differ", `<a v="0.1"/>`, `<a v="0.1001"/>`, false},
		{"words compare exactly", `<a v="True"/>`, `<a v="true"/>`, false},
		{"missing child differs", `<a><b/></a>`, `<a/>`, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := canonicalize(t, []byte(tc.got)).diff(canonicalize(t, []byte(tc.want)), "")
			if tc.expected {
				if got != "" {
					t.Fatalf("documents differ: %s", got)
				}
				return
			}
			if got == "" {
				t.Fatal("documents matched, want a difference")
			}
		})
	}
}

package api

import (
	"strings"
	"testing"

	"go.viam.com/test"
)

func TestIsASCIIPrintable(t *testing.T) {
	for _, tc := range []struct {
		name  string
		label string
		err   string
	}{
		{name: "empty is allowed", label: ""},
		{name: "plain ascii", label: "my-entity_1"},
		{name: "space is printable", label: "my entity"},
		{name: "tilde is the last printable byte", label: "~"},
		// DEL (0x7f) is not printable, but the range check is `r > 127`, so it
		// slips through. Flip this case to expect "not ascii" if that becomes
		// `r > 126`.
		{name: "del is accepted despite not being printable", label: "a\x7fb"},
		{name: "exactly 100 bytes", label: strings.Repeat("a", 100)},

		{name: "101 bytes is too long", label: strings.Repeat("a", 101), err: "too long"},
		{name: "tab is below the printable range", label: "a\tb", err: "not ascii"},
		{name: "newline is below the printable range", label: "a\nb", err: "not ascii"},
		{name: "0x80 is above the range", label: "a\u0080b", err: "not ascii"},
		{name: "unit separator is below the range", label: "a\x1fb", err: "not ascii"},
		{name: "non-ascii rune", label: "café", err: "not ascii"},
		{name: "emoji", label: "box 📦", err: "not ascii"},
		{name: "invalid utf-8", label: "\xff\xfe", err: "not valid utf-8"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := isASCIIPrintable(tc.label)

			if tc.err == "" {
				test.That(t, err, test.ShouldBeNil)
				return
			}
			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, tc.err)
		})
	}
}

// A multi-byte rune can pass the 100-character reading of the limit while
// failing the 100-byte one. The check counts bytes, and the ascii check rejects
// it first regardless.
func TestIsASCIIPrintableCountsBytesNotRunes(t *testing.T) {
	label := strings.Repeat("é", 60)
	test.That(t, len(label), test.ShouldEqual, 120)

	err := isASCIIPrintable(label)

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "too long")
}

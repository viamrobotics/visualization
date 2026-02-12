package server

import (
	"errors"
	"unicode/utf8"
)

// isASCIIPrintable checks if a string is ASCII printable and within the allowed length.
// Returns an error if the label is not valid utf-8, too long, or contains non-ASCII characters.
func isASCIIPrintable(label string) error {
	if !utf8.ValidString(label) {
		return errors.New("label is not valid utf-8")
	}

	if len(label) > 100 {
		return errors.New("label is too long (max 100 characters)")
	}
	for _, r := range label {
		if r > 127 || r < 32 {
			return errors.New("label is not ascii")
		}
	}

	return nil
}

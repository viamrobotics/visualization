package main

import (
	"go/token"
	"path/filepath"
	"strings"
)

const fallbackPackageName = "kinematics"

// defaultPackageName derives a Go package name from the base name of dir: lowercased, characters
// outside [a-z0-9_] and leading digits dropped, falling back to "kinematics" when nothing valid is
// left.
func defaultPackageName(dir string) string {
	base := strings.ToLower(filepath.Base(filepath.Clean(dir)))
	var b strings.Builder
	for _, r := range base {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '_' {
			if b.Len() == 0 && r >= '0' && r <= '9' {
				continue
			}
			b.WriteRune(r)
		}
	}
	name := b.String()
	if !token.IsIdentifier(name) {
		return fallbackPackageName
	}
	return name
}

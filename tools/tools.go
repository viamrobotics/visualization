//go:build tools
// +build tools

// Package tools tracks dependencies for build tools
package tools

import (
	_ "google.golang.org/protobuf/cmd/protoc-gen-go"
)

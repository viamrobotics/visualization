package kinematics

import (
	"bytes"
	_ "embed"
	"errors"
	"fmt"
	"go/format"
	"go/token"
	"strings"
	"text/template"
)

// GoLoaderFileName is the generated Go file AddGoLoader writes beside the model.
const GoLoaderFileName = "kinematics.go"

//go:embed templates/loader/kinematics.go.tmpl
var goLoaderTemplateSource string

var goLoaderTemplate = template.Must(template.New(GoLoaderFileName).Parse(goLoaderTemplateSource))

// AddGoLoader adds GoLoaderFileName to o: a Go file in package packageName that embeds
// ModelFileName and exposes `Model(name string) (referenceframe.Model, error)`. It imports only
// RDK. regenerate is the shell command quoted in the file's generated-code header. packageName must
// be a valid, non-keyword Go identifier.
func (o *Output) AddGoLoader(packageName, regenerate string) error {
	if !token.IsIdentifier(packageName) {
		return fmt.Errorf("package name %q is not a valid Go identifier", packageName)
	}
	if strings.ContainsAny(regenerate, "\r\n") {
		return errors.New("regenerate command must not contain a newline")
	}
	if _, ok := o.Files[ModelFileName]; !ok {
		return fmt.Errorf("output has no %s to embed", ModelFileName)
	}
	var buf bytes.Buffer
	data := struct{ Package, Regenerate string }{packageName, regenerate}
	if err := goLoaderTemplate.Execute(&buf, data); err != nil {
		return fmt.Errorf("render Go loader: %w", err)
	}
	src, err := format.Source(buf.Bytes())
	if err != nil {
		return fmt.Errorf("format Go loader: %w", err)
	}
	o.Files[GoLoaderFileName] = src
	return nil
}

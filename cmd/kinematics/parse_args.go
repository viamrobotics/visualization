package main

import (
	"errors"
	"flag"
	"io"
)

// parseInterspersed parses fs over args allowing flags before or after the single positional
// argument, and returns that positional.
func parseInterspersed(fs *flag.FlagSet, args []string, stderr io.Writer) (string, error) {
	fs.SetOutput(stderr)
	if err := fs.Parse(args); err != nil {
		return "", err
	}
	if fs.NArg() == 0 {
		return "", errors.New("missing path argument")
	}
	positional := fs.Arg(0)
	if err := fs.Parse(fs.Args()[1:]); err != nil {
		return "", err
	}
	if fs.NArg() > 0 {
		return "", errors.New("unexpected extra arguments")
	}
	return positional, nil
}

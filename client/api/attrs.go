package api

import "github.com/viam-labs/motion-tools/draw"

// Attrs holds common attributes for all Draw* calls.
type Attrs struct{}

func (a *Attrs) toDrawableOptions() []draw.DrawableOption {
	if a == nil {
		return nil
	}
	var opts []draw.DrawableOption
	return opts
}

func entityAttributes(id, parent string, attrs *Attrs) []draw.DrawableOption {
	var opts []draw.DrawableOption
	if parent != "" {
		opts = append(opts, draw.WithParent(parent))
	}
	if id != "" {
		opts = append(opts, draw.WithID(id))
	}
	return append(opts, attrs.toDrawableOptions()...)
}

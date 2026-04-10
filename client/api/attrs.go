package api

import "github.com/viam-labs/motion-tools/draw"

// Attrs holds common attributes for all Draw* calls.
type Attrs struct {
	// ShowAxesHelper controls whether the axes helper is shown. Nil defaults to true.
	ShowAxesHelper *bool

	// Invisible controls whether the entity is hidden by default. Nil defaults to false.
	Invisible *bool
}

func (a *Attrs) toDrawableOptions() []draw.DrawableOption {
	if a == nil {
		return nil
	}
	var opts []draw.DrawableOption
	if a.ShowAxesHelper != nil {
		opts = append(opts, draw.WithAxesHelper(*a.ShowAxesHelper))
	}
	if a.Invisible != nil && *a.Invisible {
		opts = append(opts, draw.WithInvisible(true))
	}
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

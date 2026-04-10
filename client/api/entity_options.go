package api

import "github.com/viam-labs/motion-tools/draw"

// MetadataOptions holds metadata fields common to all Draw* calls.
type MetadataOptions struct {
	// ShowAxesHelper controls whether the axes helper is shown. Nil defaults to true.
	ShowAxesHelper *bool

	// Invisible controls whether the entity is hidden by default. Nil defaults to false.
	Invisible *bool
}

func (m *MetadataOptions) toDrawableOptions() []draw.DrawableOption {
	if m == nil {
		return nil
	}
	var opts []draw.DrawableOption
	if m.ShowAxesHelper != nil {
		opts = append(opts, draw.WithAxesHelper(*m.ShowAxesHelper))
	}
	if m.Invisible != nil && *m.Invisible {
		opts = append(opts, draw.WithInvisible(true))
	}
	return opts
}

func entityOptions(id, parent string, meta *MetadataOptions) []draw.DrawableOption {
	var opts []draw.DrawableOption
	if parent != "" {
		opts = append(opts, draw.WithParent(parent))
	}
	if id != "" {
		opts = append(opts, draw.WithID(id))
	}
	return append(opts, meta.toDrawableOptions()...)
}

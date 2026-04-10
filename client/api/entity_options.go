package api

import "github.com/viam-labs/motion-tools/draw"

// Options holds metadata fields common to all Draw* calls.
type Options struct{}

func (m *Options) toDrawableOptions() []draw.DrawableOption {
	if m == nil {
		return nil
	}
	var opts []draw.DrawableOption
	return opts
}

func entityOptions(id, parent string, meta *Options) []draw.DrawableOption {
	var opts []draw.DrawableOption
	if parent != "" {
		opts = append(opts, draw.WithParent(parent))
	}
	if id != "" {
		opts = append(opts, draw.WithID(id))
	}
	return append(opts, meta.toDrawableOptions()...)
}

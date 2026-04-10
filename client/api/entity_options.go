package api

import "github.com/viam-labs/motion-tools/draw"

// MetadataOptions holds metadata fields common to all Draw* calls.
type MetadataOptions struct{}

func (m *MetadataOptions) toDrawableOptions() []draw.DrawableOption {
	if m == nil {
		return nil
	}
	var opts []draw.DrawableOption
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

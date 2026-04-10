package api

import "github.com/viam-labs/motion-tools/draw"

func entityOptions(id, parent string, showAxesHelper *bool) []draw.DrawableOption {
	var opts []draw.DrawableOption
	if parent != "" {
		opts = append(opts, draw.WithParent(parent))
	}
	if id != "" {
		opts = append(opts, draw.WithID(id))
	}
	if showAxesHelper != nil {
		opts = append(opts, draw.WithAxesHelper(*showAxesHelper))
	}
	return opts
}

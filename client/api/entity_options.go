package api

import "github.com/viam-labs/motion-tools/draw"

func entityOptions(id, parent string) []draw.DrawableOption {
	var opts []draw.DrawableOption
	if parent != "" {
		opts = append(opts, draw.WithParent(parent))
	}
	if id != "" {
		opts = append(opts, draw.WithID(id))
	}
	return opts
}

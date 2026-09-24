package main

import (
	"fmt"
	"math"
	"time"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/pointcloud"
)

// The chunked scenes stream this many points in half-million-point chunks,
// which is what puts the loading progress bar on screen long enough for the
// spec to catch it.
const (
	chunkedPoints    = 2_500_000
	chunkedChunkSize = 500_000
)

// A deliberately small chunked cloud, for the reconnect spec, which loads one
// twice. It is still several chunks with per-point colors, which is what
// exercises the chunked paths. Millions of points only make each load slow.
const (
	smallChunkedPoints    = 50_000
	smallChunkedChunkSize = 10_000
)

// fibonacciSphere spreads points evenly over a sphere using the golden angle,
// so a cloud that arrives partly, or out of order, reads as a visible gap
// rather than a plausible blob.
func fibonacciSphere(count int) pointcloud.PointCloud {
	pc := pointcloud.NewBasicPointCloud(count)
	goldenAngle := math.Pi * (3 - math.Sqrt(5))
	const radius = 2000.0

	for i := range count {
		frac := float64(i) / float64(count)
		phi := math.Acos(1 - 2*frac)
		theta := goldenAngle * float64(i)
		_ = pc.Set(r3.Vector{
			X: radius * math.Sin(phi) * math.Cos(theta),
			Y: radius * math.Sin(phi) * math.Sin(theta),
			Z: radius * math.Cos(phi),
		}, nil)
	}

	return pc
}

// hueRamp walks the hue wheel once across the cloud, so a per-point color
// buffer that arrives misaligned shows up as a banding shift.
func hueRamp(count int) []draw.Color {
	colors := make([]draw.Color, count)
	total := float32(count)
	for i := range colors {
		colors[i] = draw.ColorFromHSV(float32(i)/total, 1, 1)
	}
	return colors
}

func drawPointCloudFile(env sceneEnv, file, name string, colors []draw.Color, downscaling float64) error {
	pc, err := pointcloud.NewFromFile(env.data(file), pointcloud.BasicType)
	if err != nil {
		return fmt.Errorf("loading %s: %w", file, err)
	}

	if _, err := api.DrawPointCloud(api.DrawPointCloudOptions{
		Name:                 name,
		PointCloud:           pc,
		Colors:               colors,
		DownscalingThreshold: downscaling,
	}); err != nil {
		return fmt.Errorf("drawing %s: %w", name, err)
	}

	return nil
}

// pointCloudFiles draws four clouds at once, which is the scene that proves
// several independent clouds coexist rather than overwriting each other.
func pointCloudFiles(env sceneEnv) error {
	for _, cloud := range []struct{ file, name string }{
		{"octagon.pcd", "octagon"},
		{"Zaghetto.pcd", "Zaghetto"},
		{"simple.pcd", "simple"},
		{"boat.pcd", "boat"},
	} {
		if err := drawPointCloudFile(env, cloud.file, cloud.name, nil, 0); err != nil {
			return err
		}
	}
	return nil
}

func pointCloudSingleColor(env sceneEnv) error {
	return drawPointCloudFile(env, "octagon.pcd", "octagon_single_color",
		[]draw.Color{draw.ColorFromName("red")}, 0)
}

func pointCloudOpacity(env sceneEnv) error {
	return drawPointCloudFile(env, "octagon.pcd", "octagon_with_opacity",
		[]draw.Color{draw.ColorFromRGBA(0, 0, 0, 64)}, 0)
}

func pointCloudPalette(env sceneEnv) error {
	palette := []draw.Color{
		draw.ColorFromName("blue"),
		draw.ColorFromName("cyan"),
		draw.ColorFromName("green"),
		draw.ColorFromName("lime"),
		draw.ColorFromName("yellow"),
		draw.ColorFromName("gold"),
		draw.ColorFromName("orange"),
		draw.ColorFromName("orangered"),
		draw.ColorFromName("red"),
		draw.ColorFromName("purple"),
	}
	return drawPointCloudFile(env, "Zaghetto.pcd", "Zaghetto_palette", palette, 0)
}

// The color count comes from simple.pcd while the cloud drawn is Zaghetto, so
// the buffer is far shorter than the cloud. That mismatch is the case: the
// client has to tolerate it rather than run off the end.
func pointCloudPerPointColors(env sceneEnv) error {
	sizing, err := pointcloud.NewFromFile(env.data("simple.pcd"), pointcloud.BasicType)
	if err != nil {
		return fmt.Errorf("loading simple.pcd: %w", err)
	}

	count := sizing.Size()
	colors := make([]draw.Color, count)
	total := float32(count)
	for i := range colors {
		frac := float32(i) / total
		colors[i] = draw.ColorFromHSV(frac, 0.5+0.5*frac, 1.0)
	}

	return drawPointCloudFile(env, "Zaghetto.pcd", "simple_per_point", colors, 0)
}

func pointCloudDownscaled(env sceneEnv) error {
	return drawPointCloudFile(env, "Zaghetto.pcd", "boat_downscaled", []draw.Color{}, 25.0)
}

// pointCloudUpdating redraws one cloud under a stable ID a hundred times,
// cycling the palette, so the visualizer has to recolor in place rather than
// accumulate a hundred clouds.
func pointCloudUpdating(env sceneEnv) error {
	pc, err := pointcloud.NewFromFile(env.data("octagon.pcd"), pointcloud.BasicType)
	if err != nil {
		return fmt.Errorf("loading octagon.pcd: %w", err)
	}

	palette := []draw.Color{
		draw.ColorFromName("red"),
		draw.ColorFromName("cyan"),
		draw.ColorFromName("yellow"),
		draw.ColorFromName("lime"),
		draw.ColorFromName("blue"),
		draw.ColorFromName("orange"),
		draw.ColorFromName("purple"),
	}

	for i := range 100 {
		if _, err := api.DrawPointCloud(api.DrawPointCloudOptions{
			ID:         "updating",
			Name:       "DrawPointCloud updating",
			PointCloud: pc,
			Colors:     []draw.Color{palette[i%len(palette)]},
		}); err != nil {
			return fmt.Errorf("drawing iteration %d: %w", i, err)
		}
		time.Sleep(16 * time.Millisecond)
	}

	return nil
}

func pointCloudChunked(sceneEnv) error {
	if _, err := api.DrawPointCloud(api.DrawPointCloudOptions{
		Name:       "chunked_point_cloud",
		PointCloud: fibonacciSphere(chunkedPoints),
		Colors:     []draw.Color{draw.ColorFromName("cyan")},
		ChunkSize:  chunkedChunkSize,
	}); err != nil {
		return fmt.Errorf("drawing the chunked cloud: %w", err)
	}
	return nil
}

func pointCloudChunkedSmall(sceneEnv) error {
	if _, err := api.DrawPointCloud(api.DrawPointCloudOptions{
		Name:       "chunked_point_cloud_small",
		PointCloud: fibonacciSphere(smallChunkedPoints),
		Colors:     hueRamp(smallChunkedPoints),
		ChunkSize:  smallChunkedChunkSize,
	}); err != nil {
		return fmt.Errorf("drawing the small chunked cloud: %w", err)
	}
	return nil
}

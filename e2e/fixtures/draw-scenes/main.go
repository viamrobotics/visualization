// Command draw-scenes puts a named scene on a running visualizer.
//
// It exists so the e2e suite can drive `client/api` the way a user does, by
// running a script against it, rather than by shelling out to `go test`. A
// warm `go test -run` invocation costs about 1.9s in package loading and
// linking; exec'ing this binary costs about 9ms.
//
// Usage:
//
//	draw-scenes -port 4100 [-data client/data] [-replay <path>] <scene>
//	draw-scenes -list
//
// The draw server must already be listening on -port. `server.Start` attaches
// to it rather than standing up its own, which is what lets a scene draw into
// a browser someone else is watching.
//
// Exits non-zero with the reason on stderr when the scene fails, no server is
// listening, or the scene name is unknown.
package main

import (
	"flag"
	"fmt"
	"log"
	"maps"
	"net"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/viam-labs/motion-tools/client/server"
)

// dialTimeout bounds the pre-flight check against a loopback port, which
// either answers immediately or is not there at all.
const dialTimeout = time.Second

func main() {
	log.SetFlags(0)
	log.SetPrefix("draw-scenes: ")

	port := flag.Int("port", server.DefaultPort, "port of the draw server to attach to")
	dataDir := flag.String("data", "client/data", "directory holding the .pcd and .ply fixtures")
	replayPath := flag.String("replay", "", "recording file for the replay scenes (default: a per-port temp file)")
	list := flag.Bool("list", false, "print every scene name and exit")
	flag.Parse()

	if *list {
		for _, name := range slices.Sorted(maps.Keys(scenes)) {
			fmt.Println(name)
		}
		return
	}

	if flag.NArg() != 1 {
		flag.Usage()
		log.Fatal("expected exactly one scene name")
	}

	name := flag.Arg(0)
	run, ok := scenes[name]
	if !ok {
		log.Fatalf("unknown scene %q. Run with -list to see them all.", name)
	}

	// Checked up front because Start would otherwise succeed by standing up its
	// own server in this process, draw into it, and lose the whole scene when
	// the process exits a moment later.
	if err := requireListener(*port); err != nil {
		log.Fatal(err)
	}

	if err := server.Start(server.DrawServerConfig{Port: *port, StaticPort: 5173}); err != nil {
		log.Fatalf("attaching to the draw server on port %d: %v", *port, err)
	}

	env := sceneEnv{
		dataDir:    *dataDir,
		replayPath: resolveReplayPath(*replayPath, *port),
	}

	if err := run(env); err != nil {
		log.Fatalf("scene %q: %v", name, err)
	}
}

func requireListener(port int) error {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), dialTimeout)
	if err != nil {
		return fmt.Errorf("no draw server is listening on port %d, so this scene would draw into a server that dies with this process", port)
	}
	return conn.Close()
}

// resolveReplayPath keeps the record and playback scenes talking to the same
// file across two process invocations, and keeps parallel workers off each
// other's recording by keying the default on the port each one owns.
func resolveReplayPath(override string, port int) string {
	if override != "" {
		return override
	}
	return filepath.Join(os.TempDir(), fmt.Sprintf("draw-scenes-replay-%d.recording", port))
}

package main

import (
	"bufio"
	"net/http"
	"os/exec"
	"strings"
	"testing"

	"go.viam.com/test"
)

func TestDrawServer_MountsKinematicsServiceInEveryBuild(t *testing.T) {
	if testing.Short() {
		t.Skip("builds the binary")
	}

	for _, tags := range []string{"", "nomotionplan"} {
		t.Run("tags="+tags, func(t *testing.T) {
			binary := t.TempDir() + "/draw-server"
			args := []string{"build", "-o", binary}
			if tags != "" {
				args = append(args, "-tags", tags)
			}
			output, err := exec.Command("go", append(args, ".")...).CombinedOutput()
			test.That(t, err, test.ShouldBeNil)
			test.That(t, string(output), test.ShouldBeEmpty)

			cmd := exec.Command(binary, "-port", "0", "-tmp-dir", t.TempDir())
			stdout, err := cmd.StdoutPipe()
			test.That(t, err, test.ShouldBeNil)
			test.That(t, cmd.Start(), test.ShouldBeNil)
			t.Cleanup(func() {
				_ = cmd.Process.Kill()
				_ = cmd.Wait()
			})

			firstLine, err := bufio.NewReader(stdout).ReadString('\n')
			test.That(t, err, test.ShouldBeNil)
			baseURL := strings.TrimSpace(strings.TrimPrefix(firstLine, listeningPrefix))

			// An unmounted path is a 404. A mounted service answers an empty request with a Connect error.
			response, err := http.Post(
				baseURL+"/kinematics.v1.KinematicsService/Build",
				"application/json",
				strings.NewReader("{}"),
			)
			test.That(t, err, test.ShouldBeNil)
			t.Cleanup(func() { _ = response.Body.Close() })
			test.That(t, response.StatusCode, test.ShouldNotEqual, http.StatusNotFound)
			test.That(t, response.Header.Get("Content-Type"), test.ShouldEqual, "application/json")
		})
	}
}

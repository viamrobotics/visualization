package main

import (
	"bufio"
	"net/url"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"go.viam.com/test"

	"github.com/viamrobotics/visualization/client/server"
)

func TestDrawServer_Smoke(t *testing.T) {
	if err := server.Start(server.DrawServerConfig{Port: 19200}); err != nil {
		t.Fatalf("server.Start: %v", err)
	}
	t.Cleanup(func() { _ = server.Stop() })

	if client := server.GetClient(); client == nil {
		t.Fatal("expected non-nil client after Start()")
	}
}

func buildDrawServer(t *testing.T) string {
	t.Helper()
	binary := t.TempDir() + "/draw-server"
	output, err := exec.Command("go", "build", "-o", binary, ".").CombinedOutput()
	if err != nil {
		t.Fatalf("go build: %v\n%s", err, output)
	}
	return binary
}

func TestDrawServer_PrintsBoundPortFirst(t *testing.T) {
	if testing.Short() {
		t.Skip("builds the binary")
	}

	binary := buildDrawServer(t)

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
	firstLine = strings.TrimSuffix(firstLine, "\n")
	test.That(t, firstLine, test.ShouldStartWith, listeningPrefix)

	parsed, err := url.Parse(strings.TrimPrefix(firstLine, listeningPrefix))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, parsed.Hostname(), test.ShouldEqual, "127.0.0.1")
	boundPort, err := strconv.Atoi(parsed.Port())
	test.That(t, err, test.ShouldBeNil)
	test.That(t, boundPort, test.ShouldBeGreaterThan, 0)

	test.That(t, cmd.Process.Signal(syscall.SIGTERM), test.ShouldBeNil)
	test.That(t, cmd.Wait(), test.ShouldBeNil)
}

func TestDrawServer_ExitsOnStdinClose(t *testing.T) {
	if testing.Short() {
		t.Skip("builds the binary")
	}

	binary := buildDrawServer(t)

	cmd := exec.Command(binary, "-port", "0", "-tmp-dir", t.TempDir(), "-exit-on-stdin-close")
	stdin, err := cmd.StdinPipe()
	test.That(t, err, test.ShouldBeNil)
	stdout, err := cmd.StdoutPipe()
	test.That(t, err, test.ShouldBeNil)
	test.That(t, cmd.Start(), test.ShouldBeNil)
	t.Cleanup(func() {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
	})

	firstLine, err := bufio.NewReader(stdout).ReadString('\n')
	test.That(t, err, test.ShouldBeNil)
	test.That(t, firstLine, test.ShouldStartWith, listeningPrefix)

	test.That(t, stdin.Close(), test.ShouldBeNil)

	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()
	select {
	case err := <-exited:
		test.That(t, err, test.ShouldBeNil)
	case <-time.After(5 * time.Second):
		t.Fatal("draw-server did not exit within 5s of stdin closing")
	}
}

# `client/api` tests

`*_test.go` are unit tests. They assert what a `Draw*` call puts on the wire, using the
`fakeService` harness in `fake_service_test.go`: a recording `DrawServiceHandler` that
`server.Start` attaches to, so `server.GetClient()` reaches the fake without anything inside
`client/api` being stubbed. No draw service, no disk buffers, no rendered scene. Run them with
`pnpm test:client`.

Add coverage for `client/api` behaviour here.

Putting entities on screen for the e2e is a separate job, handled by `e2e/fixtures/draw-scenes`.
That is a binary rather than a test package, because a scene is a script someone runs against a
live visualizer, not an assertion. See `e2e/README.md`.

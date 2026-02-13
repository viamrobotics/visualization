# motion-tools

`motion-tools` provides a 3D visualization interface for spatial data using Viam's APIs. Use it for motion-related monitoring, testing, and debugging.

## Getting started

To run the app, you will need to set your project up by installing the app dependencies and ensuring you can connect
to your machines if required.

### Project setup

The easiest way to get started is using our automated setup script:

```bash
make setup
```

This will install all required dependencies (Node.js, pnpm, bun, Go, buf), install project packages, and generate protobuf code.

After setup completes, add the shell configuration it prints to your shell config file (`~/.zshrc` or `~/.bashrc`), then restart your terminal.

<details>
<summary>Manual setup</summary>

If the above does not work for you, or if you prefer to install dependencies manually:

1. [Install fnm](https://github.com/Schniz/fnm#installation): `curl -fsSL https://fnm.vercel.app/install | bash`
2. Install Node.js: `fnm install 22 && fnm use 22`
3. [Install pnpm](https://pnpm.io/installation): `curl -fsSL https://get.pnpm.io/install.sh | sh -`
4. [Install bun](https://bun.sh/docs/installation): `curl -fsSL https://bun.sh/install | bash`
5. [Install Go](https://go.dev/doc/install)
6. [Install buf](https://buf.build/docs/installation): download from GitHub releases
7. Install Go tools: `go install google.golang.org/protobuf/cmd/protoc-gen-go@latest`
8. Install dependencies: `pnpm install`
9. Generate protobufs: `make proto`

</details>

### Configure machines (optional)

To connect the visualizer to your machines, create an `.env.local` file with connection configs:

```
VITE_CONFIGS='
{
  "fleet-rover-01": {
    "host": "fleet-rover-01-main.ve4ba7w5qr.viam.cloud",
    "partId": "myPartID",
    "apiKeyId": "myApiKeyId",
    "apiKeyValue": "MyApiKeyValue",
    "signalingAddress": "https://app.viam.com:443"
  }
}
'
```

You can also add machine configs directly in the visualizer UI via the machine config page (bottom right).

### Start the visualizer

```bash
make up
```

This builds the app (if needed) and starts the server. Visit http://localhost:5173/ to open the visualizer.

#### Running multiple instances

The `make up` command accepts two options:

1. `STATIC_PORT` -- port for the static file server (default: `5173`)
2. `WS_PORT` -- port for the websocket server used by the draw client API

```bash
# in one terminal
make up

# in another terminal
make up STATIC_PORT=5174
```

Both instances will be available at their respective ports, and draw client API calls will render in both.

> [!NOTE]
> The `WS_PORT` is not fully configurable at the moment, so passing it will only affect where the frontend listens for the websocket server, but calls with the draw client API are currently hardcoded to point to `"http://localhost:3000/"`. If this is a feature you require, please submit a request to the viz team!

### Draw to the visualizer

With the visualizer running, use the Go SDK to draw programmatically:

```bash
go get github.com/viam-labs/motion-tools
```

```go
import (
    "github.com/golang/geo/r3"
    "github.com/viam-labs/motion-tools/client/api"
    "github.com/viam-labs/motion-tools/draw"
)

func main() {
    api.DrawLine(api.DrawLineOptions{
        Name:      "my-line",
        Positions: []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 100, Y: 100, Z: 100}},
        Colors:    []draw.Color{draw.NewColor(draw.WithName("blue"))},
    })
}
```

The SDK provides two packages:

- **`draw`** -- Scene primitives, snapshots, colors, and serialization
- **`client/api`** -- Real-time drawing functions for the live visualizer

For guides, examples, and full API reference, see the **[documentation](docs/)**.

## Programmatic camera control

It is possible to programmatically move the viewer camera and modify camera settings during runtime.

To do this, open the Javascript console while using the visualizer and call methods or set properties on the `cameraControls` object.

The following APIs are available: https://github.com/yomotsu/camera-controls?tab=readme-ov-file#properties

## Contributing

If you are contributing to `motion-tools`, run the development web server instead of `make up`:

```bash
pnpm dev
```

This starts the app with hot-reloading for frontend changes.

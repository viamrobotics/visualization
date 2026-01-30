# motion-tools

`motion-tools` aims to provide a visualization interface for any spatial information using Viam's APIs. This typically means motion-related monitoring, testing, and debugging.

## Getting started

To run the app, you will need to set your project up by installing the app dependencies and ensuring you can connect
to your machines if required.

### Project setup

The easiest way to get started is using our automated setup script:

```bash
make setup
```

This single command will:

1. Install **fnm** (Fast Node Manager) and **Node.js 22**
2. Install **pnpm** package manager
3. Install **bun** runtime
4. Install **Go** and **buf** (for protobuf generation)
5. Install all project dependencies
6. Generate protobuf code

After setup completes, add the shell configuration it prints to your shell config file (`~/.zshrc` or `~/.bashrc`), then restart your terminal.

#### Manual setup

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

### Env files for machine configs

To add a list of connection configs in an `.env.local` file, use the following format:

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

### Running the app locally

After setup completes, you can start a local app server with:

```bash
make up
```

This starts the app as a static site. The build part of the process will only run if you have not built the app yet as a part of `make up`, or your build is out of date.

#### Running multiple apps

If you want to be able to run multiple versions of the app, you can configure how the servers run. The `make up` command can accept two options:

1. `STATIC_PORT` is the port for the static file server, and defaults to `5173`
2. `WS_PORT` is the port for the websocket server used to communicate with the draw client API

> [!NOTE]
> The `WS_PORT` is not fully configurable at the moment, so passing it will only affect where the frontend listens for the websocket server, but calls with the draw client API are currently hardcoded to point to `"http://localhost:3000/"`. If this is a feature you require, please submit a request to the viz team!

To run two apps using the same web socket server, run:

```
# in one terminal
make up

# in another terminal
make up STATIC_PORT=5174
```

The apps should be available on `http://localhost:5173/` and `http://localhost:5174/`, and calls to the draw client API should render in both.

### Local development

If you are contributing to `motion-tools`, you should just run the development web server with:

```
pnpm dev
```

## Running the visualizer

To visit the visualizer, go to `http://localhost:5173/`

Open the machine config page (bottom right) and enter in connection details to visualize a specific machine. You can also add machine configs from an env file (see below).

## Executing drawing commands

The visualizer includes a golang package that allows executing commands to the visualizer.

The list of available commands [can be found here](https://pkg.go.dev/github.com/viam-labs/motion-tools@v0.9.0/client/client).

## Programmatic camera control

It is possible to programmatically move the viewer camera and even modify the camera settings during runtime.

To do this, open the Javascript console while using the visualizer and call methods or set properties on the `cameraControls` object.

The following APIs are available: https://github.com/yomotsu/camera-controls?tab=readme-ov-file#properties

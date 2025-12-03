## motion-tools

`motion-tools` aims to provide a visualization interface for any spatial information using Viam's APIs. This typically means motion-related monitoring, testing, and debugging.

### Getting started

#### Using the app locally

The easiest way to get started is using our automated setup script:

```bash
make setup
```

This single command will:

1. Install and configure **nvm** (Node Version Manager)
2. Install the latest **Node.js LTS** version via nvm
3. Install **pnpm** package manager
4. Install **bun** runtime
5. Install all project dependencies

After setup completes, start the server:

```bash
make up      # Build and run a local app service
```

This runs a local server that serves the app as a static site. The build part of the process will only run if you have
not built the app yet as a part of `make up`, or your build is out of date.

#### Manual Setup

If you prefer to install dependencies manually:

1. [Install nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
2. Install Node.js LTS: `nvm install --lts && nvm use --lts`
3. [Install pnpm](https://pnpm.io/installation)
4. [Install bun](https://bun.sh/docs/installation)
5. Install dependencies: `pnpm i`
6. Run local app server: `pnpm dev`

#### Available Make Commands

- `make setup` - Complete development environment setup
- `make up` - Build and start production server (fast, incremental builds)
- `make build` - Build the application for production
- `make clean` - Remove build artifacts
- `make help` - Show available commands

### Running the visualizer

To visit the visualizer, go to `http://localhost:5173/`

Open the machine config page (bottom right) and enter in connection details to visualize a specific machine. You can also add machine configs from an env file (see below).

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

### Executing drawing commands

The visualizer includes a golang package that allows executing commands to the visualizer.

The list of available commands [can be found here](https://pkg.go.dev/github.com/viam-labs/motion-tools@v0.9.0/client/client).

### Programmatic camera control

It is possible to programmatically move the viewer camera and even modify the camera settings during runtime.

To do this, open the Javascript console while using the visualizer and call methods or set properties on the `cameraControls` object.

The following APIs are available: https://github.com/yomotsu/camera-controls?tab=readme-ov-file#properties

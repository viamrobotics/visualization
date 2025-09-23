## motion-tools

`motion-tools` aims to provide a visualization interface for any spatial information using Viam's APIs. This typically means motion-related monitoring, testing, and debugging.

### Getting started

1. [Install pnpm](https://pnpm.io/installation)
2. [Install bun](https://bun.sh/docs/installation)
3. Install dependencies: `pnpm i`
4. Run local app server: `pnpm dev`

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

{"host":"edit-frame-prod-main.i6h2oo7033.viam.cloud","partId":"3e56adc1-df84-4758-b6e4-923f446335cb","apiKeyId":"c6f06050-54a1-4024-bc0a-f28ab009eb4f","apiKeyValue":"52sdu1pb4s9sfmsrf2131r51jpgpevls","signalingAddress":"https://app.viam.com:443"}

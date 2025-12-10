# Motion Tools Draw API - Protocol Buffers

This directory contains the Protocol Buffer (protobuf) definitions for the Motion Tools Draw API v1.

## Overview

The Draw API provides message definitions for visualizing motion planning data in 3D space, including geometric shapes, robot transforms, and scene configuration.

## Proto Files

- `draw/v1/drawing.proto`: Defines primitive drawing shapes and complex geometries.
- `draw/v1/metadata.proto`: Contains metadata for shapes.
- `draw/v1/scene.proto`: Defines scene configuration and rendering settings.
- `draw/v1/snapshot.proto`: The top-level message that represents a complete scene snapshot.
- `draw/v1/transforms.proto`: Wrapper for Viam's common Transform messages (maintained for backwards compatibility).

## Code Generation

The protos use separate buf templates for different languages:

- **`buf.gen.go.yaml`**: Go code generation using `protoc-gen-go`, outputs:
  - `draw/v1/`
- **`buf.gen.typescript.yaml`**: TypeScript code generation using Buf's ES plugin, outputs:
  - `src/lib/common/v1/` (Viam dependency)
  - `src/lib/draw/v1/`

### Generate Code

**Generate both Go and TypeScript:**

```bash
make proto-gen
```

### Other Commands

```bash
make proto-lint    # Lint proto files
make proto-format  # Format proto files
make proto-clean   # Remove generated code
make proto-vendor  # Vendor dependencies
```

## Dependencies

The Draw API depends on:

- **`buf.build/viamrobotics/api`**: Provides common Viam types
- **`buf.build/googleapis/googleapis`**: Provides standard Google types

### Vendored Dependencies

To ensure consistent builds and enable offline development, external protobuf dependencies are vendored (copied locally) to `protos/vendor/`.

### Managing Vendored Dependencies

**Update vendored dependencies:**

```bash
make proto-vendor
```

This command:

1. Exports the latest version of `buf.build/viamrobotics/api` to `protos/vendor/`
2. Preserves the directory structure for proper imports
3. Overwrites any existing vendored files

**When to re-vendor:**

- When updating to a new version of Viam's API
- When vendored files are missing or corrupted
- When setting up a new development environment

> **Note**: The `proto-gen` target automatically runs `proto-vendor` to ensure dependencies are up-to-date before code generation.

The buf configuration (`buf.yaml`) handles path resolution for both local and vendored protos.

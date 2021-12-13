# Setup-Zig

Use the Zig compiler in your @ziglang Github Actions workflows.

Defaults to the latest release. May pass `with.version` to pin a version.

https://github.com/ziglang/zig

> Note: This Action is a WIP and currently only works on Linux runners.

## Usage

```yaml
- uses: nektro/actions-setup-zig@v1

- run: zig version

- run: zig build
```

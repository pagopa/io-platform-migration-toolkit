# make-workspace-artifact Action

This action allows creating an artifact of a workspace contained in a monorepo that uses `yarn 3.x`, `turbo` and stores the deployable applications in `/apps/` folder.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repository's `.github/workflows` directory. An [example workflow](#example-cache-workflow) is available below. For more information, see the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

**This action must be executed after the workspace build.**

### Inputs

- `workspace-name` the name of the workspace. must match the name of the folder containing it (`/apps/{workspace-name}`)
- `workspace-type` (optional )the type of the workspace, indicating the kind of artifact to build. If not provided, the action will try to infer it from the workspace's content. Supported types:
  - `function-app` Azure Function App
  - `next-standalone` Standalone Next.js application
  - `package` a package to be published to NPM or compatible registry

### Outputs

- `artifact-path` that path of the generated artifact

### Example

```yaml
name: My workflow

on:
  push: {}

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout monorepo
        uses: actions/checkout@v3
        with:
          fetch-depth: 2

      -  # build the workspace

      - name: Make artifact
        id: make_artifact
        uses: "pagopa/io-std/make-workspace-artifact@main"
        with:
          # it lives in /apps/my-workspace
          workspace-name: my-workspace
          # optional
          workspace-type: package

      - uses: actions/upload-artifact@v3
        with:
          path: ${{ steps.make_artifact.outputs.artifact-path }}
```

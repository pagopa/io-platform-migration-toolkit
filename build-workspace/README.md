# build-workspace Action

This action allows building JavaScript workspaces in monorepo that uses `yarn 3.x`, `turbo` and stores the deployable applications in `/apps/` folder.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repository's `.github/workflows` directory. An [example workflow](#example-cache-workflow) is available below. For more information, see the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### Inputs

- `workspace-name` the name of the workspace. must match the name of the folder containing it (`/apps/{workspace-name}`)

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

      - name: Build workspace
        uses: "pagopa/io-std/build-workspace@main"
        with:
          # it lives in /apps/my-workspace
          workspace-name: my-workspace
```

# 🌳 Project Tree CLI

A command-line tool for generating a filtered project tree from a local directory and mapping it to GitHub raw file URLs.

**Why use this?**

When working with language models, documentation tools, or remote reviewers, sometimes you need to **show what’s in a project without dumping all the code**.

This CLI was **specifically designed to support code understanding by LLMs (language models)**, by generating a filtered and normalized file tree (`projectTree.json`) with GitHub raw links.

The resulting JSON file is small, structured, and machine-readable — perfect for tools or agents that **don’t need the full source**, just the layout.

Other possible (but untested) uses:

* 📈 Static analysis tools (with JSON adapters)
* 📚 Documentation or interactive code viewers
* 🔍 Project visualizers (e.g. D3 or Mermaid-based renderers)
* 🤖 AI coding agents (that ask for a file list or directory overview)
* 🧪 CI checks for project file validation or audits

## Features

* 🐾 Traverse a project directory and generate a JSON tree
* ☂️ Filter out ignored files using `.gitignore` and custom `.ptignore`
* 🔗 Generate GitHub raw links from local file paths
* 🛠️ Optional interactive creation of missing ignore files
* #️ Supports commit hash or branch references
* 📄 Outputs `projectTree.json` with enriched file metadata

## Installation

Install globally as a development tool:

```bash
npm install -D project-tree
```

### Usage after installation

```bash
project-tree \
  --github-url=krabat1/projectTree/main \
  --depth=0 \
  --verbose=2
```

## npx Usage

Use the CLI directly without installing:

```bash
npx github:krabat1/projectTree \
  --github-url=krabat1/projectTree/main \
  --depth=0 \
  --verbose=2
```

## Arguments

* `--github-url=<user>/<repo>/<branch|commit>` – **(required)** GitHub repo reference
* `--depth=<number>` – Depth of the working directory relative to project root (default `0`)
* `--verbose=<0|1|2>` – Logging detail level:

  * `0`: Only critical info (default)
  * `1`: Step highlights
  * `2`: Full trace with emoji prefixes

## Output

Creates a `projectTree.json` file in the base directory, containing a filtered representation of your project files with optional GitHub raw links.

```json
[
  {
    "type": "file",
    "name": "index.js",
    "path": "src/index.js",
    "size": 3420,
    "githubRaw": "https://raw.githubusercontent.com/user/repo/main/src/index.js"
  },
  {
    "type": "directory",
    "name": "components",
    "path": "src/components",
    "children": [ ... ]
  }
]
```

## Ignore Files

The tool supports both `.gitignore` and custom `.ptignore` files for precise filtering. If missing, the CLI offers to create them interactively with sensible defaults:

`.ptignore` example:

```
lib/
test-fixtures/
**/*.log
.git
.DS_Store
Thumbs.db
```

## License

MIT 

## Author

Created by [krabat1](https://github.com/krabat1). Contributions welcome!

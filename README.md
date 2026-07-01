# Gemini Search Model

[![OMP Extension](https://img.shields.io/badge/OMP-extension-blue)](https://github.com/can1357/oh-my-pi)

OMP extension that overrides the Gemini model for web_search grounded
requests.

## Motivation

OMP's `web_search` tool uses a built-in grounding model that may differ
from the model you actually want. Instead of the grounding service deciding
your model, this extension lets you pick it yourself.

## Quick start

```bash
omp extensions install jaeyeopme/gemini-search-model --enable
```

The extension is idle by default — it passes requests through unchanged
until you set the target model.

```bash
# Activate: rewrite grounded search requests to use gemini-3.1-pro
export GEMINI_SEARCH_MODEL=gemini-3.1-pro
```

## Configuration

| Env var | Default | Description |
| --- | --- | --- |
| `GEMINI_SEARCH_MODEL` | _(none)_ | Target model for grounded search requests. Extension is pass-through when unset. |

## Requirements

- OMP (Oh My Pi) with extension support.
- No external dependencies — only the OMP Extension API.

## Uninstall

```bash
omp extensions remove gemini-search-model
```

## Development

```bash
# Install locally for testing
omp extensions install ./gemini-search-model.ts --enable

# Verify it's active
GEMINI_SEARCH_MODEL=gemini-2.5-pro omp run "search the web for latest AI news"
```

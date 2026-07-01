# Gemini Search Model

[![OMP Extension](https://img.shields.io/badge/OMP-extension-blue)](https://github.com/can1357/oh-my-pi)

OMP extension that overrides the Gemini model for web_search grounded
requests. When the grounding API rewrites your model, this extension swaps
it back to your preferred model.

<details open>
<summary><b>How it works</b></summary>

The extension intercepts `globalThis.fetch` and rewrites the model name in
Gemini `:streamGenerateContent` requests whose body contains known
grounded-search fingerprints (`googleSearch`, `google_search`, etc.).

Both the URL path and the JSON body are patched — the URL receives the
desired model, and the body replaces the source model string.

</details>

## Quick start

```bash
omp extensions install jaeyeopme/gemini-search-model --enable
```

The extension activates immediately. By default it rewrites `gemini-2.5-flash`
→ `gemini-3.1-pro` for grounded search requests.

## Configuration

| Env var | Default | Description |
| --- | --- | --- |
| `GEMINI_SEARCH_MODEL` | `gemini-3.1-pro` | Target model for grounded search requests |

The source model (what gets rewritten) is hardcoded to `gemini-2.5-flash` —
the default grounding model injected by the web search tool.

```bash
# Use a different target model
export GEMINI_SEARCH_MODEL=gemini-2.5-pro
```

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

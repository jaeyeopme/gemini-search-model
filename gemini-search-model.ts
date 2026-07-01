// OMP extension: override Gemini model for web_search grounded requests.
// Defaults to gemini-2.5-flash (web search default). Set GEMINI_SEARCH_MODEL to change.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

const DEFAULT_SOURCE_MODEL = "gemini-2.5-flash"
const DEFAULT_TARGET_MODEL = "gemini-2.5-flash"
const MARK = Symbol.for("omp.gemini-search-model.installed")
const GROUNDED_SEARCH_RE = /google[_ ]?search/i

export function targetModel(): string {
  return (process.env.GEMINI_SEARCH_MODEL || DEFAULT_TARGET_MODEL).trim()
}

export async function bodyText(input: RequestInfo | URL, init?: RequestInit): Promise<string | undefined> {
  if (typeof init?.body === "string") return init.body
  if (init?.body instanceof Uint8Array) return new TextDecoder().decode(init.body)
  if (input instanceof Request) {
    try {
      return await input.clone().text()
    } catch {
      return undefined
    }
  }
  return undefined
}

export function rewriteGeminiModelInUrl(rawUrl: string, model: string): string {
  return rawUrl.replace(
    /(\/models\/)([^/:?]+)(:streamGenerateContent\b)/,
    (_match, prefix, _oldModel, suffix) => `${prefix}${encodeURIComponent(model)}${suffix}`,
  )
}

export function rewriteGeminiModelInBody(body: string, source: string, target: string): string {
  if (source === target) return body
  return body.replaceAll(source, target)
}

export function withBody(input: RequestInfo | URL, init: RequestInit | undefined, body: string): [RequestInfo | URL, RequestInit | undefined] {
  if (input instanceof Request && init?.body === undefined) {
    return [new Request(input, { body }), init]
  }
  return [input, { ...(init ?? {}), body }]
}

export function requestUrl(input: RequestInfo | URL): string | undefined {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url
  return undefined
}

export function withUrl(input: RequestInfo | URL, url: string): RequestInfo | URL {
  if (typeof input === "string") return url
  if (input instanceof URL) return new URL(url)
  if (input instanceof Request) return new Request(url, input)
  return input
}

export default function geminiSearchModel(_pi: ExtensionAPI): void {
  const g = globalThis as typeof globalThis & { [MARK]?: boolean }
  if (g[MARK]) return

  const originalFetch = globalThis.fetch.bind(globalThis)
  const source = DEFAULT_SOURCE_MODEL

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const model = targetModel()
    if (model === source) return originalFetch(input, init)

    const url = requestUrl(input)
    const isGeminiGenerate = !!url && url.includes(":streamGenerateContent")

    if (isGeminiGenerate) {
      const body = await bodyText(input, init)
      if (body && GROUNDED_SEARCH_RE.test(body)) {
        const rewrittenUrl = rewriteGeminiModelInUrl(url, model)
        const rewrittenBody = rewriteGeminiModelInBody(body, source, model)
        if (rewrittenUrl !== url || rewrittenBody !== body) {
          const nextInput = rewrittenUrl !== url ? withUrl(input, rewrittenUrl) : input
          const [finalInput, finalInit] = rewrittenBody !== body ? withBody(nextInput, init, rewrittenBody) : [nextInput, init]
          return originalFetch(finalInput, finalInit)
        }
      }
    }

    return originalFetch(input, init)
  }) as typeof fetch

  g[MARK] = true
}

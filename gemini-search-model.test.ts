// Smoke tests for gemini-search-model extension.
// Run: bun test
import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test"
import {
  targetModel,
  bodyText,
  rewriteGeminiModelInUrl,
  rewriteGeminiModelInBody,
  withBody,
  requestUrl,
  withUrl,
} from "./gemini-search-model"

// ─── Pure transforms ─────────────────────────────────────────────

describe("rewriteGeminiModelInUrl", () => {
  test("replaces model in streamGenerateContent URL", () => {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent"
    const result = rewriteGeminiModelInUrl(url, "gemini-3.1-pro")
    expect(result).toContain("/models/gemini-3.1-pro:streamGenerateContent")
    expect(result).not.toContain("gemini-2.5-flash")
  })

  test("passes through non-matching URL unchanged", () => {
    const url = "https://api.example.com/v1/chat"
    expect(rewriteGeminiModelInUrl(url, "gemini-3.1-pro")).toBe(url)
  })
})

describe("rewriteGeminiModelInBody", () => {
  test("replaces source model with target model", () => {
    const body = JSON.stringify({ model: "gemini-2.5-flash", tools: [{ googleSearch: {} }] })
    const result = rewriteGeminiModelInBody(body, "gemini-2.5-flash", "gemini-3.1-pro")
    expect(result).toContain("gemini-3.1-pro")
    expect(result).not.toContain("gemini-2.5-flash")
  })

  test("no-op when source equals target", () => {
    const body = '{"model":"gemini-2.5-flash"}'
    expect(rewriteGeminiModelInBody(body, "gemini-2.5-flash", "gemini-2.5-flash")).toBe(body)
  })

  test("no-op when source not found in body", () => {
    const body = '{"model":"gemini-3.1-pro"}'
    expect(rewriteGeminiModelInBody(body, "gemini-2.5-flash", "gemini-3.1-pro")).toBe(body)
  })
})

// ─── URL / body helpers ──────────────────────────────────────────

describe("requestUrl", () => {
  test("extracts URL from string", () => {
    expect(requestUrl("https://example.com/api")).toBe("https://example.com/api")
  })

  test("extracts URL from URL object", () => {
    expect(requestUrl(new URL("https://example.com/api"))).toBe("https://example.com/api")
  })

  test("extracts URL from Request", () => {
    expect(requestUrl(new Request("https://example.com/api"))).toBe("https://example.com/api")
  })
})

describe("withUrl", () => {
  test("replaces string URL", () => {
    expect(withUrl("https://old.com", "https://new.com")).toBe("https://new.com")
  })

  test("replaces URL object", () => {
    const result = withUrl(new URL("https://old.com"), "https://new.com/path?q=1")
    expect(result).toBeInstanceOf(URL)
    expect((result as URL).href).toBe("https://new.com/path?q=1")
  })
})

describe("withBody", () => {
  test("replaces init body", () => {
    const [, init] = withBody("https://example.com", {}, '{"x":1}')
    expect(init?.body).toBe('{"x":1}')
  })
})

describe("bodyText", () => {
  test("reads string body", async () => {
    const result = await bodyText("https://example.com", { body: '{"test":1}' })
    expect(result).toBe('{"test":1}')
  })

  test("reads Uint8Array body", async () => {
    const bytes = new TextEncoder().encode('{"test":1}')
    const result = await bodyText("https://example.com", { body: bytes })
    expect(result).toBe('{"test":1}')
  })

  test("returns undefined for no body", async () => {
    const result = await bodyText("https://example.com")
    expect(result).toBeUndefined()
  })
})

// ─── Integration ─────────────────────────────────────────────────

describe("geminiSearchModel integration", () => {
  let originalFetch: typeof globalThis.fetch
  let fetchCalls: { input: RequestInfo | URL; init?: RequestInit }[]

  beforeAll(() => {
    originalFetch = globalThis.fetch
    fetchCalls = []
    // Mock fetch to capture calls
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input, init })
      return new Response('{"ok":true}')
    }) as typeof fetch

    // Activate with a target model
    process.env.GEMINI_SEARCH_MODEL = "gemini-3.1-pro"
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
    delete process.env.GEMINI_SEARCH_MODEL
  })

  test("rewrites grounded search request URL and body", async () => {
    // Import triggers the extension — it wraps fetch
    const { default: install } = await import("./gemini-search-model")
    // Force re-install by resetting mark (test-only)
    const MARK = Symbol.for("omp.gemini-search-model.installed")
    const g = globalThis as typeof globalThis & { [MARK]?: boolean }
    delete g[MARK]
    install({} as any)

    fetchCalls = []
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent"
    const body = JSON.stringify({
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }],
      contents: [{ parts: [{ text: "hello" }] }],
    })

    await globalThis.fetch(url, { body, method: "POST" })

    expect(fetchCalls.length).toBe(1)
    const calledUrl = typeof fetchCalls[0].input === "string"
      ? fetchCalls[0].input
      : (fetchCalls[0].input as Request).url
    expect(calledUrl).toContain("gemini-3.1-pro")
    expect(fetchCalls[0].init?.body).toContain("gemini-3.1-pro")
    expect(fetchCalls[0].init?.body).not.toContain("gemini-2.5-flash")
  })

  test("passes through non-grounded request unchanged", async () => {
    fetchCalls = []
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent"
    const body = JSON.stringify({ contents: [{ parts: [{ text: "hello" }] }] })

    await globalThis.fetch(url, { body, method: "POST" })

    expect(fetchCalls.length).toBe(1)
    expect(fetchCalls[0].init?.body).toBe(body)
  })

  test("no-op when source equals target (default behavior)", async () => {
    fetchCalls = []
    process.env.GEMINI_SEARCH_MODEL = "gemini-2.5-flash"  // same as source

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent"
    const body = JSON.stringify({
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }],
      contents: [{ parts: [{ text: "hello" }] }],
    })

    await globalThis.fetch(url, { body, method: "POST" })

    // Should pass through unchanged since source == target
    const calledUrl = typeof fetchCalls[0].input === "string"
      ? fetchCalls[0].input
      : (fetchCalls[0].input as Request).url
    expect(calledUrl).toContain("gemini-2.5-flash")
    expect(fetchCalls[0].init?.body).toBe(body)
  })
})

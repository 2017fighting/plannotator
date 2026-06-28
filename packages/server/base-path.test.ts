import { describe, expect, it } from "bun:test";
import { basePathFromUrl, getBasePathFromEnv, injectBasePath, normalizeBasePath } from "./base-path";

describe("normalizeBasePath", () => {
    it("returns empty for blank input", () => {
        expect(normalizeBasePath("")).toBe("")
        expect(normalizeBasePath("   ")).toBe("")
    })
    it("ensures a leading slash and no trailing slash", () => {
        expect(normalizeBasePath("plannotator/abc")).toBe("/plannotator/abc")
        expect(normalizeBasePath("/plannotator/abc/")).toBe("/plannotator/abc")
        expect(normalizeBasePath("/plannotator/abc")).toBe("/plannotator/abc")
    })
})

describe("getBasePathFromEnv", () => {
    it("reads and normalizes PLANNOTATOR_BASE_PATH", () => {
        expect(getBasePathFromEnv({ PLANNOTATOR_BASE_PATH: "/plannotator/tok" })).toBe("/plannotator/tok")
    })
    it("returns empty when unset", () => {
        expect(getBasePathFromEnv({})).toBe("")
    })
})

describe("basePathFromUrl", () => {
    it("extracts the path of a public URL", () => {
        expect(basePathFromUrl("https://hapi.example/plannotator/abc123")).toBe("/plannotator/abc123")
    })
    it("returns empty for an invalid URL", () => {
        expect(basePathFromUrl("not-a-url")).toBe("")
    })
})

describe("injectBasePath", () => {
    const html = (head: string) => `<!DOCTYPE html><html><head>${head}</head><body></body></html>`

    it("injects the global + shim right after <head>", () => {
        const out = injectBasePath(html('<meta charset="utf-8">'), "/plannotator/tok")
        expect(out).toContain("window.__PLANNOTATOR_BASE_PATH__=\"/plannotator/tok\"")
        expect(out).toContain("window.fetch=function")
        // injection lands immediately after the <head ...> tag, before <meta>
        expect(out.indexOf("window.__PLANNOTATOR_BASE_PATH__")).toBeLessThan(out.indexOf('<meta charset'))
    })

    it("prepends the injection when no <head> is present", () => {
        const out = injectBasePath("<div>hi</div>", "/p/t")
        expect(out.indexOf("window.__PLANNOTATOR_BASE_PATH__")).toBe(0)
    })

    it("is a no-op when basePath is empty", () => {
        const original = html("")
        expect(injectBasePath(original, "")).toBe(original)
    })
})

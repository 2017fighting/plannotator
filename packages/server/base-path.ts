/**
 * Base-path support for serving plannotator under a URL prefix (e.g.
 * `/plannotator/<token>` when reverse-tunneled through the hapi hub).
 *
 * The hub strips the prefix before forwarding, so the server's own routes are
 * unchanged — only the served client must prefix its root-relative
 * `fetch`/`EventSource`/`WebSocket` URLs. Rather than edit every client call
 * site (and rebuild the UI), we inject a tiny shim + global into the HTML at
 * serve time. See `adr/0003-serve-via-hapi-hub-tunnel.md`.
 */

/** Normalize a base path to "" or "/<segments>" with no trailing slash. */
export function normalizeBasePath(raw: string): string {
    const trimmed = (raw ?? "").trim()
    if (!trimmed) {
        return ""
    }
    const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    if (withSlash.length > 1 && withSlash.endsWith("/")) {
        return withSlash.slice(0, -1)
    }
    return withSlash
}

/** Read PLANNOTATOR_BASE_PATH from the environment, normalized. */
export function getBasePathFromEnv(env: Record<string, string | undefined> = process.env): string {
    return normalizeBasePath(env.PLANNOTATOR_BASE_PATH ?? "")
}

/** Extract the path component of a public URL (e.g. `https://h/plannotator/abc` -> `/plannotator/abc`). */
export function basePathFromUrl(publicUrl: string): string {
    try {
        return normalizeBasePath(new URL(publicUrl).pathname)
    } catch {
        return ""
    }
}

const SHIM = `<script>(function(){var B=window.__PLANNOTATOR_BASE_PATH__||"";if(!B){return}function p(u){return (typeof u==="string"&&u.charAt(0)==="/"&&u.charAt(1)!=="/")?B+u:u}var f=window.fetch.bind(window);window.fetch=function(i,o){return f(p(i),o)};var E=window.EventSource;function ES(u,o){return new E(p(u),o)}ES.prototype=E.prototype;window.EventSource=ES;var W=window.WebSocket;function WS(u,pr){return new W(p(u),pr)}WS.prototype=W.prototype;window.WebSocket=WS})();</script>`

/**
 * Inject the base-path global + URL-prefixing shim into the served HTML. If
 * basePath is empty the HTML is returned unchanged.
 */
export function injectBasePath(html: string, basePath: string): string {
    if (!basePath) {
        return html
    }
    const injection = `<script>window.__PLANNOTATOR_BASE_PATH__=${JSON.stringify(basePath)};</script>${SHIM}`
    if (/<head[^>]*>/i.test(html)) {
        return html.replace(/<head[^>]*>/i, (match) => `${match}${injection}`)
    }
    return `${injection}${html}`
}

# 3. Serve plannotator through the hapi hub via a reverse tunnel

Date: 2026-06-28

## Status

Proposed — design agreed; not yet implemented. The full cross-repo design,
tunnel protocol, and phased implementation plan live in
**`hapi/adr/0001-plannotator-tunnel.md`**. This ADR records only the
plannotator-side decisions.

## Context

plannotator runs on the agent's machine as a Bun HTTP server coupled to the
agent process (plan in on stdin; approve/deny out on stdout). It opens
`localhost:<port>` in a browser and has no base-path support, no auth, and
real-time paths that need streaming (SSE + a `/api/agent-terminal/pty/<token>`
WebSocket). Settings are persisted in cookies keyed by port.

The deployment runs plannotator on dev machines ("runners") that connect to a
central hapi hub exposed publicly at `hapi.raenzo.com`. The goal is to reach
plannotator at `hapi.raenzo.com/plannotator/<token>` — across all three modes
(plan review, code review, annotate) and across multiple runners — and to
auto-open that public page when the agent triggers it.

The hub already intercepts `ExitPlanMode` and has its own basic plan-review UI,
so plan review specifically is wired through the hub's existing permission
decision path (see hapi ADR 0001).

## Decision

plannotator stays a self-contained app running on the runner. The hub
reverse-tunnels its HTTP/WebSocket traffic over the hub↔runner Socket.IO link
(see hapi ADR 0001 for the protocol). plannotator's required changes:

1. **Runtime base path.** Accept a `PLANNOTATOR_BASE_PATH` (e.g.
   `/plannotator/<token>`) and prefix **all** routes with it: server route
   handlers, the served single-file HTML (templated at serve time), the client
   `fetch` layer (currently root-relative `/api/…`), the WebSocket URL, the SSE
   URLs, and the share-link base.
2. **Hub mode.** A mode/flag in which plannotator serves under the base path and
   does **not** self-open `localhost`. For self-started modes (code review,
   annotate), plannotator shells out to `hapi tunnel register --port <p>` on
   server-ready, reads the returned public URL from stdout, and opens it. For
   plan review, hapi launches plannotator itself and owns registration;
   plannotator just serves and emits the decision on stdout as today.
3. **Cookie/storage scoping.** Because concurrent plannotator sessions now share
   one origin under different path prefixes, settings cookies must be scoped to
   `Path=/plannotator/<token>` (or storage keyed by token) to avoid collisions.
4. **ExitPlanMode hook removal on hapi-driven agents.** plannotator's own
   `PermissionRequest` / `ExitPlanMode` hook (see `apps/hook/hooks/hooks.json`)
   must not fire on agents driven by hapi, since hapi owns the ExitPlanMode event
   and launches plannotator itself. (On standalone, non-hapi agents the hook is
   unchanged.)
5. **Auth stays out of plannotator.** plannotator remains auth-unaware; the hub
   validates the owner cookie at `/plannotator/<token>/*` before the tunnel
   opens, so the localhost server continues to trust local callers.

Native binary handling, the PTY WebSocket, SSE, image upload/download, and the
share/paste feature are otherwise unchanged — they flow transparently through
the tunnel.

## Consequences

- plannotator's single-file HTML build must support a dynamic base path injected
  at serve time (the build cannot hardcode `/api/…`).
- plannotator forks from upstream for the base-path + hub-mode + cookie-scoping
  changes. The base-path and "custom open URL" changes are generally useful and
  should be PR'd upstream to minimize divergence; the `hapi tunnel register`
  integration is hapi-specific and stays in a fork.
- plannotator gains a soft dependency on `hapi` being on `PATH` for the
  self-started modes (code review / annotate). When `hapi` is absent, plannotator
  falls back to today's localhost-open behavior.
- Plan review on hapi-driven agents no longer opens a localhost browser tab;
  instead hapi opens `/plannotator/<token>` (web UI + optional local browser).
- See hapi ADR 0001 for the tunnel protocol, backpressure, lifecycle, and the
  phased rollout (plannotator changes land across Phases 1, 5, and 6).

## Phase 1 implementation notes

**Done — Phase 1 plannotator (serves under a base path + self-registers with the hub):**

- `packages/server/hub-mode.ts` — `registerWithHapiHub(port, mode?, label?)` shells
  `hapi tunnel register`, returns the public URL (or null → localhost fallback).
  Split into `buildRegisterArgs`/`parsePublicUrl` for testing.
- `packages/server/base-path.ts` — `normalizeBasePath`/`getBasePathFromEnv`/
  `basePathFromUrl`/`injectBasePath`. The hub strips `/plannotator/<token>` before
  forwarding, so the server *routes* are unchanged; instead `injectBasePath`
  inserts a `window.__PLANNOTATOR_BASE_PATH__` global + a tiny shim (right after
  `<head>`) that prefixes root-relative `fetch`/`EventSource`/`WebSocket` URLs.
  Single injection point — **no client edits, no UI rebuild needed**.
- `packages/server/index.ts` — reads `PLANNOTATOR_BASE_PATH` (hub sets it when
  launching) and `PLANNOTATOR_HUB_MODE`; serves `injectBasePath(htmlContent,
  activeBasePath)`; in hub mode calls `registerWithHapiHub` on server-ready,
  derives the base path from the returned URL, and opens the public URL instead
  of `localhost`.

Both helpers are pure and runtime-verified. (The formal `bun test` run is
blocked by a pre-existing missing `@happy-dom` UI-test dep in this checkout;
full `tsc` is blocked by uninstalled `@plannotator/shared/*` workspace deps —
neither related to these changes.)

**Remaining:** Phase 5 — drop plannotator's `ExitPlanMode` hook on hapi-driven
agents (`apps/hook/hooks/hooks.json`); Phase 6 — scope settings cookies to
`Path=/plannotator/<token>`. The shim prefixes string URLs starting with `/`; a
future PTY WebSocket (Phase 4) that builds an absolute `ws://host/...` URL from
`location` will need host-relative prefixing then. A proper upstream-able
base-path refactor (per-call prefixing in `packages/ui/*` instead of the shim)
can follow.

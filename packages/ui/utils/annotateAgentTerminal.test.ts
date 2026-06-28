import { describe, expect, test } from "bun:test";
import type { AgentTerminalAgent } from "@plannotator/shared/agent-terminal";
import { resolveAnnotateAgentId, resolveAgentTerminalWebSocketUrl } from "./annotateAgentTerminal";

const agents: AgentTerminalAgent[] = [
  { id: "claude", name: "Claude", available: true },
  { id: "opencode", name: "OpenCode", available: false },
  { id: "codex", name: "Codex", available: true },
];

describe("resolveAnnotateAgentId", () => {
  test("keeps a saved available agent", () => {
    expect(resolveAnnotateAgentId(agents, "codex")).toBe("codex");
  });

  test("skips a saved unavailable agent", () => {
    expect(resolveAnnotateAgentId(agents, "opencode")).toBe("claude");
  });

  test("returns empty when no agents are available", () => {
    expect(
      resolveAnnotateAgentId(
        agents.map((agent) => ({ ...agent, available: false })),
        "claude",
      ),
    ).toBe("");
  });
});

describe("resolveAgentTerminalWebSocketUrl", () => {
  // The PTY WS path is root-relative ("/api/agent-terminal/pty/<tk>"); resolving it against
  // location.href must keep the /plannotator/<token> base path, or the WS would miss the tunnel.
  function withWindow<T>(href: string, basePath: string, fn: () => T): T {
    const g = globalThis as unknown as { window?: { location: { href: string }; __PLANNOTATOR_BASE_PATH__?: string } };
    const previous = g.window;
    g.window = { location: { href }, __PLANNOTATOR_BASE_PATH__: basePath };
    try {
      return fn();
    } finally {
      g.window = previous;
    }
  }

  test("prefixes the base path when serving under /plannotator/<token>", () => {
    const url = withWindow(
      "https://hapi.raenzo.com/plannotator/0123456789abcdef0123456789abcdef/review",
      "/plannotator/0123456789abcdef0123456789abcdef",
      () => resolveAgentTerminalWebSocketUrl("/api/agent-terminal/pty/tk"),
    );
    expect(url).toBe("wss://hapi.raenzo.com/plannotator/0123456789abcdef0123456789abcdef/api/agent-terminal/pty/tk");
  });

  test("leaves the URL unchanged when no base path is set (localhost dev)", () => {
    const url = withWindow("http://localhost:8080/review", "", () =>
      resolveAgentTerminalWebSocketUrl("/api/agent-terminal/pty/tk"),
    );
    expect(url).toBe("ws://localhost:8080/api/agent-terminal/pty/tk");
  });
});

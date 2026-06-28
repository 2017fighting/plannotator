import type { AgentTerminalAgent } from "@plannotator/shared/agent-terminal";
import { storage } from "./storage";

const DEFAULT_AGENT_KEY = "plannotator-annotate-agent-terminal-default";

export function getSavedAnnotateAgentId(): string | null {
  return storage.getItem(DEFAULT_AGENT_KEY);
}

export function saveAnnotateAgentId(agentId: string): void {
  storage.setItem(DEFAULT_AGENT_KEY, agentId);
}

export function resolveAnnotateAgentId(
  agents: AgentTerminalAgent[],
  savedAgentId: string | null,
): string {
  const availableAgents = agents.filter((agent) => agent.available);
  if (savedAgentId && availableAgents.some((agent) => agent.id === savedAgentId)) {
    return savedAgentId;
  }
  return availableAgents[0]?.id ?? "";
}

export function resolveAgentTerminalWebSocketUrl(path: string): string {
  // When served under a base path (e.g. /plannotator/<token> via the hapi hub tunnel), the
  // PTY WS path is root-relative and must be prefixed — otherwise resolving it against
  // location.href discards the base path and the WS misses the tunnel. See adr/0003.
  const basePath =
    (window as unknown as { __PLANNOTATOR_BASE_PATH__?: string }).__PLANNOTATOR_BASE_PATH__ ?? "";
  const url = new URL(basePath + path, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

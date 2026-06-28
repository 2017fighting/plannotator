/**
 * Hub-mode registration for plannotator.
 *
 * When running under the hapi hub, plannotator shells out to
 * `hapi tunnel register --port <p>` to expose its localhost server at
 * `https://<hub>/plannotator/<token>` and returns that public URL to open
 * instead of `localhost`. See `adr/0003-serve-via-hapi-hub-tunnel.md` and the
 * cross-repo `hapi/adr/0001-plannotator-tunnel.md`.
 *
 * Returns null when `hapi` is absent or registration fails, so callers keep
 * today's localhost-open behavior as a fallback.
 */
import { spawnSync } from "node:child_process";

export interface HubRegistration {
    publicUrl: string;
}

export interface RegisterCommandResult {
    stdout: string;
    status: number | null;
    error?: Error;
}

export type RegisterCommandRunner = (args: string[]) => RegisterCommandResult;

const DEFAULT_TIMEOUT_MS = 15_000;

function defaultRunner(args: string[]): RegisterCommandResult {
    const result = spawnSync("hapi", args, { encoding: "utf8", timeout: DEFAULT_TIMEOUT_MS });
    return {
        stdout: result.stdout ?? "",
        status: result.status,
        error: result.error
    };
}

/** Build the `hapi tunnel register` argv for the given local port + metadata. */
export function buildRegisterArgs(port: number, mode?: string, label?: string): string[] {
    const args = ["tunnel", "register", "--port", String(port)];
    if (mode) {
        args.push("--mode", mode);
    }
    if (label) {
        args.push("--label", label);
    }
    return args;
}

/** Extract the public URL from the command's stdout (first http(s) line). */
export function parsePublicUrl(stdout: string): string | null {
    for (const raw of stdout.split("\n")) {
        const line = raw.trim();
        if (/^https?:\/\//.test(line)) {
            return line;
        }
    }
    return null;
}

/**
 * Register the local plannotator server with the hapi hub. Returns the public
 * URL to open, or null if `hapi` is unavailable or registration failed.
 */
export function registerWithHapiHub(
    port: number,
    mode?: string,
    label?: string,
    runner: RegisterCommandRunner = defaultRunner
): HubRegistration | null {
    const result = runner(buildRegisterArgs(port, mode, label));
    if (result.error || result.status !== 0) {
        return null;
    }
    const publicUrl = parsePublicUrl(result.stdout);
    return publicUrl ? { publicUrl } : null;
}

import { describe, expect, it } from "bun:test";
import {
    buildRegisterArgs,
    parsePublicUrl,
    registerWithHapiHub,
    type RegisterCommandRunner
} from "./hub-mode";

describe("buildRegisterArgs", () => {
    it("includes only the port by default", () => {
        expect(buildRegisterArgs(1234)).toEqual(["tunnel", "register", "--port", "1234"])
    })

    it("includes --mode and --label when provided", () => {
        expect(buildRegisterArgs(99, "review", "main diff")).toEqual([
            "tunnel", "register", "--port", "99", "--mode", "review", "--label", "main diff"
        ])
    })
})

describe("parsePublicUrl", () => {
    it("returns the first http(s) line from stdout", () => {
        expect(parsePublicUrl("\nregistering...\nhttps://hub.example/plannotator/abc\n")).toBe(
            "https://hub.example/plannotator/abc"
        )
    })

    it("returns null when no URL is present", () => {
        expect(parsePublicUrl("nope\nerror: something")).toBeNull()
    })
})

describe("registerWithHapiHub", () => {
    it("returns the public URL on a successful registration", () => {
        const runner: RegisterCommandRunner = () => ({
            stdout: "https://hapi.example/plannotator/abc123\n",
            status: 0
        })
        expect(registerWithHapiHub(8080, undefined, undefined, runner)).toEqual({
            publicUrl: "https://hapi.example/plannotator/abc123"
        })
    })

    it("passes port, mode, and label through to the runner", () => {
        let captured: string[] = []
        const runner: RegisterCommandRunner = (args) => {
            captured = args
            return { stdout: "https://x/plannotator/t\n", status: 0 }
        }
        registerWithHapiHub(7, "annotate", "lbl", runner)
        expect(captured).toEqual([
            "tunnel", "register", "--port", "7", "--mode", "annotate", "--label", "lbl"
        ])
    })

    it("returns null when hapi exits non-zero (e.g. not installed / rejected)", () => {
        const runner: RegisterCommandRunner = () => ({ stdout: "", status: 1 })
        expect(registerWithHapiHub(8080, undefined, undefined, runner)).toBeNull()
    })

    it("returns null on a spawn error (hapi missing from PATH)", () => {
        const runner: RegisterCommandRunner = () => ({
            stdout: "",
            status: null,
            error: new Error("ENOENT")
        })
        expect(registerWithHapiHub(8080, undefined, undefined, runner)).toBeNull()
    })
})

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseAllowVersionDriftEnv,
  parseStartupCliFlags,
  resolveAllowVersionDrift,
} from "../../src/cli-flags.js";
import {
  asJsonTextOrRaw,
  classifyPassCliAuthErrorText,
  createRunPassCli,
  evaluatePassCliCompatibility,
  logErr,
  normalizePassCliArgs,
  parseSemver,
  PassCliAuthError,
  requireWriteGate,
} from "../../src/server.js";

import { restoreProcessEnvAndMocks } from "./test-support.js";

afterEach(restoreProcessEnvAndMocks);

describe("helpers", () => {
  it("formats valid JSON and trims whitespace", () => {
    expect(asJsonTextOrRaw('  {"a":1}  ')).toBe('{\n  "a": 1\n}');
  });

  it("returns raw trimmed text when input is not JSON", () => {
    expect(asJsonTextOrRaw("   not-json   ")).toBe("not-json");
  });

  it("returns empty string for blank input", () => {
    expect(asJsonTextOrRaw("\n\t  ")).toBe("");
  });

  it("parses semver from version text", () => {
    expect(parseSemver("pass-cli 1.5.2 (41cf394)")).toEqual({
      major: 1,
      minor: 5,
      patch: 2,
    });
    expect(parseSemver("no-version")).toBeNull();
  });

  it("evaluates compatibility policy", () => {
    expect(
      evaluatePassCliCompatibility(
        { major: 1, minor: 5, patch: 9 },
        { major: 1, minor: 5, patch: 2 },
      ),
    ).toMatchObject({ compatibilityStatus: "compatible" });
    expect(
      evaluatePassCliCompatibility(
        { major: 1, minor: 6, patch: 0 },
        { major: 1, minor: 5, patch: 2 },
      ),
    ).toMatchObject({ compatibilityStatus: "compatible" });
    expect(
      evaluatePassCliCompatibility(
        { major: 1, minor: 4, patch: 9 },
        { major: 1, minor: 5, patch: 2 },
      ),
    ).toMatchObject({ compatibilityStatus: "possibly_incompatible" });
    expect(
      evaluatePassCliCompatibility(
        { major: 2, minor: 0, patch: 0 },
        { major: 1, minor: 5, patch: 2 },
      ),
    ).toMatchObject({ compatibilityStatus: "possibly_incompatible" });
    expect(
      evaluatePassCliCompatibility(
        { major: 2, minor: 0, patch: 0 },
        { major: 1, minor: 5, patch: 2 },
        { allowVersionDrift: true },
      ),
    ).toMatchObject({ compatibilityStatus: "compatible" });
  });

  it("parses startup CLI flags for version drift behavior", () => {
    expect(parseStartupCliFlags([])).toEqual({});
    expect(parseStartupCliFlags(["--allow-version-drift"])).toEqual({ allowVersionDrift: true });
    expect(parseStartupCliFlags(["--allow-version-drift=false"])).toEqual({
      allowVersionDrift: false,
    });
    expect(() => parseStartupCliFlags(["--allow-version-drift=maybe"])).toThrow(
      'Invalid value for --allow-version-drift: "maybe" (expected true/false).',
    );
  });

  it("parses allow-version-drift env values", () => {
    expect(parseAllowVersionDriftEnv(undefined)).toBeUndefined();
    expect(parseAllowVersionDriftEnv("true")).toBe(true);
    expect(parseAllowVersionDriftEnv("1")).toBe(true);
    expect(parseAllowVersionDriftEnv("false")).toBe(false);
    expect(parseAllowVersionDriftEnv("0")).toBe(false);
    expect(() => parseAllowVersionDriftEnv("maybe")).toThrow(
      'Invalid value for PASS_CLI_ALLOW_VERSION_DRIFT: "maybe" (expected true/false).',
    );
  });

  it("resolves allow-version-drift with flag precedence over env", () => {
    expect(resolveAllowVersionDrift({}, {} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      resolveAllowVersionDrift({}, { PASS_CLI_ALLOW_VERSION_DRIFT: "true" } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      resolveAllowVersionDrift({ allowVersionDrift: false }, {
        PASS_CLI_ALLOW_VERSION_DRIFT: "true",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      resolveAllowVersionDrift({ allowVersionDrift: true }, {
        PASS_CLI_ALLOW_VERSION_DRIFT: "false",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("enforces write gate by env and confirmation", () => {
    delete process.env.ALLOW_WRITE;
    expect(() => requireWriteGate(true)).toThrow("Write operations are disabled");

    process.env.ALLOW_WRITE = "1";
    expect(() => requireWriteGate()).toThrow("requires explicit confirmation");
    expect(() => requireWriteGate(true)).not.toThrow();
  });

  it("runs pass-cli with provided binary and formats success output", async () => {
    process.env.PASS_CLI_BIN = "custom-pass-cli";

    const execImpl = vi.fn().mockResolvedValue({
      stdout: Buffer.from("ok"),
      stderr: Buffer.from("warn"),
    });

    const run = createRunPassCli(execImpl as any);
    const result = await run(["info"], "stdin-data");

    expect(execImpl).toHaveBeenCalledTimes(1);
    expect(execImpl).toHaveBeenCalledWith(
      "custom-pass-cli",
      ["info", "--output", "json"],
      expect.objectContaining({
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
        input: "stdin-data",
      }),
    );
    expect(result).toEqual({ stdout: "ok", stderr: "warn" });
  });

  it("normalizes output flags by command policy", () => {
    expect(
      normalizePassCliArgs(["item", "create", "login", "--title", "GitHub", "--output", "json"]),
    ).toEqual(["item", "create", "login", "--title", "GitHub"]);

    expect(normalizePassCliArgs(["item", "list", "--share-id", "s1"])).toEqual([
      "item",
      "list",
      "--share-id",
      "s1",
      "--output",
      "json",
    ]);

    expect(normalizePassCliArgs(["item", "list", "--output", "human", "--", "Work"])).toEqual([
      "item",
      "list",
      "--output",
      "json",
      "--",
      "Work",
    ]);

    expect(
      normalizePassCliArgs([
        "item",
        "attachment",
        "download",
        "--share-id",
        "s1",
        "--item-id",
        "i1",
        "--attachment-id",
        "a1",
        "--output",
        "/tmp/file.bin",
      ]),
    ).toEqual([
      "item",
      "attachment",
      "download",
      "--share-id",
      "s1",
      "--item-id",
      "i1",
      "--attachment-id",
      "a1",
      "--output",
      "/tmp/file.bin",
    ]);
  });

  it("createRunPassCli applies output normalization before execution", async () => {
    const execImpl = vi.fn().mockResolvedValue({ stdout: "{}", stderr: "" });
    const run = createRunPassCli(execImpl as any);

    await run(["item", "create", "login", "--title", "Example", "--output", "json"]);
    await run(["item", "list", "--share-id", "s1"]);

    expect(execImpl).toHaveBeenNthCalledWith(
      1,
      "pass-cli",
      ["item", "create", "login", "--title", "Example"],
      expect.any(Object),
    );
    expect(execImpl).toHaveBeenNthCalledWith(
      2,
      "pass-cli",
      ["item", "list", "--share-id", "s1", "--output", "json"],
      expect.any(Object),
    );
  });

  it("wraps pass-cli failures with stdout/stderr and cause", async () => {
    const err = {
      message: "spawn failed",
      code: 9,
      stdout: "std-out",
      stderr: "std-err",
    };

    const execImpl = vi.fn().mockRejectedValue(err);
    const run = createRunPassCli(execImpl as any);

    await expect(run(["info"])).rejects.toThrow("pass-cli failed (code=9): spawn failed");

    try {
      await run(["info"]);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("stderr:\nstd-err");
      expect((error as Error).message).toContain("stdout:\nstd-out");
      expect((error as Error).cause).toBe(err);
    }
  });

  it("falls back to unknown code and default message for malformed errors", async () => {
    const execImpl = vi.fn().mockRejectedValue({});
    const run = createRunPassCli(execImpl as any);
    await expect(run(["info"])).rejects.toThrow(
      "pass-cli failed (code=unknown): pass-cli invocation failed",
    );
  });

  it("classifies auth failure text", () => {
    expect(classifyPassCliAuthErrorText("Please log in first")).toBe("AUTH_REQUIRED");
    expect(classifyPassCliAuthErrorText("This operation requires an authenticated client")).toBe(
      "AUTH_REQUIRED",
    );
    expect(classifyPassCliAuthErrorText("Session expired, run login")).toBe("AUTH_EXPIRED");
    expect(classifyPassCliAuthErrorText("unknown error")).toBeNull();
  });

  it("surfaces standardized auth errors from pass-cli failures", async () => {
    const execImpl = vi.fn().mockRejectedValue({
      message: "command failed",
      code: 1,
      stderr: "not logged in",
      stdout: "",
    });
    const run = createRunPassCli(execImpl as any);

    await expect(run(["info"])).rejects.toBeInstanceOf(PassCliAuthError);

    try {
      await run(["info"]);
    } catch (error) {
      expect(error).toBeInstanceOf(PassCliAuthError);
      expect((error as Error).message).toContain("[AUTH_REQUIRED]");
      expect((error as Error).message).toContain("Do not provide credentials");
    }
  });

  it("logErr writes to stderr with server prefix", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    logErr("started");
    expect(stderrSpy).toHaveBeenCalledWith("[proton-pass-community-mcp] started\n");
  });
});

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

afterEach(() => {
  vi.unstubAllEnvs();
  restoreProcessEnvAndMocks();
});

const NODE_STDIN_FIXTURE = `
  const chunks = [];
  const timeout = setTimeout(() => process.exit(70), 2000);
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    clearTimeout(timeout);
    process.stdout.write(JSON.stringify({
      input: Buffer.concat(chunks).toString("utf8"),
      reason: process.env.PROTON_PASS_AGENT_REASON ?? null,
    }));
  });
`;

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
    expect(execImpl.mock.calls[0][2].env).not.toBe(process.env);
    expect(result).toEqual({ stdout: "ok", stderr: "warn" });
  });

  it.each([undefined, "", 'first line\n{"mock":"value-🧪"}\n'])(
    "delivers stdin and EOF to a real Node child (%j)",
    async (input) => {
      vi.stubEnv("PASS_CLI_BIN", process.execPath);
      const result = await createRunPassCli()(["--eval", NODE_STDIN_FIXTURE], input);

      expect(JSON.parse(result.stdout).input).toBe(input ?? "");
      expect(result.stderr).toBe("");
    },
  );

  it("isolates concurrent agent reasons in real child environments", async () => {
    vi.stubEnv("PASS_CLI_BIN", process.execPath);
    vi.stubEnv("PROTON_PASS_AGENT_REASON", "inherited reason");
    const run = createRunPassCli();
    const reasons = ["  first request 🧪  ", "second request"];
    const pending = reasons.map((agentReason) =>
      run(["--eval", NODE_STDIN_FIXTURE], undefined, { agentReason }),
    );
    pending.push(run(["--eval", NODE_STDIN_FIXTURE]));

    expect(process.env.PROTON_PASS_AGENT_REASON).toBe("inherited reason");
    const results = await Promise.all(pending);
    expect(results.map(({ stdout }) => JSON.parse(stdout).reason)).toEqual([
      ...reasons,
      "inherited reason",
    ]);
    expect(process.env.PROTON_PASS_AGENT_REASON).toBe("inherited reason");
  });

  it.each(["", " \n\t ", "x".repeat(301), "🧪".repeat(301)])(
    "rejects an invalid reason before invoking the child (%j)",
    async (agentReason) => {
      const execImpl = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });

      await expect(
        createRunPassCli(execImpl)(["info"], undefined, { agentReason }),
      ).rejects.toThrow("agentReason");
      expect(execImpl).not.toHaveBeenCalled();
    },
  );

  it("allows 300 Unicode code points, not just 300 UTF-16 code units", async () => {
    const agentReason = "🧪".repeat(300);
    const execImpl = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });

    await createRunPassCli(execImpl)(["info"], undefined, { agentReason });

    expect(execImpl.mock.calls[0][2].env.PROTON_PASS_AGENT_REASON).toBe(agentReason);
  });

  it("preserves actual child failure output and exit code", async () => {
    vi.stubEnv("PASS_CLI_BIN", process.execPath);
    const script = `
      process.stdin.resume();
      process.stdin.on("end", () => {
        process.stdout.write("partial output");
        process.stderr.write("failure details");
        process.exitCode = 23;
      });
    `;

    await expect(createRunPassCli()(["--eval", script], "mock input")).rejects.toMatchObject({
      cause: { code: 23, stdout: "partial output", stderr: "failure details" },
    });
  });

  it("handles a closed stdin pipe and stops the child instead of hanging", async () => {
    vi.stubEnv("PASS_CLI_BIN", process.execPath);
    const script = `
      require("node:fs").closeSync(0);
      setTimeout(() => process.exit(0), 2000);
    `;

    await expect(
      createRunPassCli()(["--eval", script], "x".repeat(1024 * 1024)),
    ).rejects.toMatchObject({ cause: { signal: "SIGKILL" } });
  });

  it("handles spawn failure without leaving stdin open", async () => {
    vi.stubEnv("PASS_CLI_BIN", `${process.execPath}-missing-runner-fixture`);

    await expect(createRunPassCli()([], "mock input")).rejects.toMatchObject({
      cause: { code: "ENOENT" },
    });
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

  it.each([
    {
      name: "a password that looks like the output flag",
      args: ["item", "create", "login", "--title", "Example", "--password", "--output"],
      expected: ["item", "create", "login", "--title", "Example", "--password=--output"],
    },
    {
      name: "a vault named -- and a hyphen-leading item title",
      args: ["item", "view", "--vault-name", "--", "--item-title", "-Entry"],
      expected: ["item", "view", "--vault-name=--", "--item-title=-Entry", "--output", "json"],
    },
    {
      name: "input and output filenames alongside a valueless force flag",
      args: ["inject", "--in-file", "-input", "--out-file", "--output", "--force"],
      expected: ["inject", "--in-file=-input", "--out-file=--output", "--force"],
    },
    {
      name: "an attachment output path that looks like an output flag",
      args: ["item", "attachment", "download", "--output", "--output"],
      expected: ["item", "attachment", "download", "--output=--output"],
    },
    {
      name: "env-file values while preserving every child argument",
      args: [
        "run",
        "--env-file",
        "--",
        "--env-file",
        "-.env",
        "--no-masking",
        "--",
        "node",
        "--env-file",
        "--output",
        "--password",
        "--",
      ],
      expected: [
        "run",
        "--env-file=--",
        "--env-file=-.env",
        "--no-masking",
        "--",
        "node",
        "--env-file",
        "--output",
        "--password",
        "--",
      ],
    },
    {
      name: "a title following the optional password-generation flag",
      args: ["item", "create", "login", "--generate-password", "--title", "-Example"],
      expected: ["item", "create", "login", "--generate-password", "--title=-Example"],
    },
    {
      name: "the template stdin marker",
      args: ["item", "create", "login", "--from-template", "-"],
      expected: ["item", "create", "login", "--from-template=-"],
    },
    {
      name: "ordinary arguments and an already-bound password",
      args: ["item", "create", "login", "--title", "Example", "--password=-secret"],
      expected: ["item", "create", "login", "--title", "Example", "--password=-secret"],
    },
  ])("binds named values before output normalization: $name", ({ args, expected }) => {
    expect(normalizePassCliArgs(args)).toEqual(expected);
  });

  it.each([
    {
      args: ["run", "--", "node", "--output", "json"],
      expected: ["run", "--", "node", "--output", "json"],
    },
    {
      args: ["run", "--output", "json", "--", "node", "--output", "human"],
      expected: ["run", "--", "node", "--output", "human"],
    },
    {
      args: ["password", "score", "--output", "human", "--", "--output"],
      expected: ["password", "score", "--output", "json", "--", "--output"],
    },
    {
      args: ["item", "list", "--", "--output", "human"],
      expected: ["item", "list", "--output", "json", "--", "--output", "human"],
    },
    {
      args: ["item", "list", "--output", "--", "--output"],
      expected: ["item", "list", "--output", "json", "--", "--output"],
    },
  ])("preserves arguments after the terminator: $args", ({ args, expected }) => {
    expect(normalizePassCliArgs(args)).toEqual(expected);
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

  it.each([
    ["Please log in first", "AUTH_REQUIRED"],
    ["Please login", "AUTH_REQUIRED"],
    ["This operation requires an authenticated client", "AUTH_REQUIRED"],
    ["Authentication required", "AUTH_REQUIRED"],
    ["UNAUTHORIZED", "AUTH_REQUIRED"],
    ["not logged in", "AUTH_REQUIRED"],
    ["Session expired, run login", "AUTH_EXPIRED"],
    ["expired session", "AUTH_EXPIRED"],
    ["token has expired", "AUTH_EXPIRED"],
    ["Unauthorized: token expired", "AUTH_EXPIRED"],
    ["Forbidden: agent lacks this capability", null],
    ["unknown error", null],
  ] as const)("classifies auth failure text: %s", (text, expected) => {
    expect(classifyPassCliAuthErrorText(text)).toBe(expected);
  });

  it("keeps forbidden capability errors generic without re-login advice", async () => {
    const failure = {
      message: "command failed",
      code: 1,
      stderr: "403 Forbidden: agent lacks this capability",
    };
    const execImpl = vi.fn().mockRejectedValue(failure);
    const error = await createRunPassCli(execImpl)(["vault", "list"]).catch(
      (error: unknown) => error,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PassCliAuthError);
    expect(error).toMatchObject({ cause: failure });
    expect((error as Error).message).toContain("Forbidden");
    expect((error as Error).message).not.toContain("pass-cli login");
    expect(error).not.toHaveProperty("userAction");
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

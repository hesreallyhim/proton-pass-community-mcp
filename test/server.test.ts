import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseAllowVersionDriftEnv,
  parseStartupCliFlags,
  resolveAllowVersionDrift,
} from "../src/cli-flags.js";

import {
  asJsonTextOrRaw,
  checkPassCliVersion,
  checkPassConnectivity,
  classifyPassCliAuthErrorText,
  injectHandler,
  runHandler,
  createRunPassCli,
  createServer,
  evaluatePassCliCompatibility,
  logErr,
  parseSemver,
  checkStatusHandler,
  PassCliAuthError,
  viewSessionInfoHandler,
  createLoginItemFromTemplateHandler,
  createCreditCardItemHandler,
  createCustomItemHandler,
  createIdentityItemHandler,
  createItemAliasHandler,
  createLoginItemHandler,
  createNoteItemHandler,
  createWifiItemHandler,
  deleteItemHandler,
  itemTotpHandler,
  listItemsHandler,
  shareItemHandler,
  generatePassphraseHandler,
  generateRandomPasswordHandler,
  scorePasswordHandler,
  searchItemsHandler,
  updateItemHandler,
  viewItemHandler,
  settingsSetDefaultVaultHandler,
  settingsUnsetDefaultVaultHandler,
  viewSettingsHandler,
  viewUserInfoHandler,
  inviteAcceptHandler,
  inviteRejectHandler,
  listInvitesHandler,
  listSharesHandler,
  createVaultHandler,
  deleteVaultHandler,
  listVaultMembersHandler,
  listVaultsHandler,
  removeVaultMemberHandler,
  shareVaultHandler,
  transferVaultHandler,
  updateVaultMemberHandler,
  updateVaultHandler,
  requireWriteGate,
  startServer,
  type PassCliResult,
  type PassCliRunner,
} from "../src/server.js";

const originalAllowWrite = process.env.ALLOW_WRITE;
const originalPassCliBin = process.env.PASS_CLI_BIN;

afterEach(() => {
  if (originalAllowWrite === undefined) delete process.env.ALLOW_WRITE;
  else process.env.ALLOW_WRITE = originalAllowWrite;

  if (originalPassCliBin === undefined) delete process.env.PASS_CLI_BIN;
  else process.env.PASS_CLI_BIN = originalPassCliBin;

  vi.restoreAllMocks();
});

function makeRunner(
  output:
    | PassCliResult
    | ((args: string[], stdin?: string) => PassCliResult | Promise<PassCliResult>) = {
    stdout: "",
    stderr: "",
  },
) {
  const fn = vi.fn<PassCliRunner>(async (args, stdin) => {
    if (typeof output === "function") return await output(args, stdin);
    return output;
  });
  return fn;
}

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
      ["info"],
      expect.objectContaining({
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
        input: "stdin-data",
      }),
    );
    expect(result).toEqual({ stdout: "ok", stderr: "warn" });
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

describe("read-only handlers", () => {
  it("viewSessionInfoHandler trims output", async () => {
    const runner = makeRunner({ stdout: " hello\n", stderr: "" });
    const result = await viewSessionInfoHandler(runner);

    expect(runner).toHaveBeenCalledWith(["info"]);
    expect(result).toEqual({ content: [{ type: "text", text: "hello" }] });
  });

  it("checkPassCliVersion parses and evaluates compatibility", async () => {
    const runner = makeRunner({ stdout: "1.5.9 (abc123)", stderr: "" });
    const result = await checkPassCliVersion(runner);

    expect(runner).toHaveBeenCalledWith(["--version"]);
    expect(result.baselineVersion).toBe("1.5.2");
    expect(result.detectedVersion).toBe("1.5.9");
    expect(result.compatibilityStatus).toBe("compatible");
  });

  it("checkPassConnectivity normalizes auth failures", async () => {
    const runner = makeRunner(async () => {
      throw new PassCliAuthError("AUTH_REQUIRED");
    });
    const result = await checkPassConnectivity(runner);

    expect(result.status).toBe("error");
    expect(result.authErrorCode).toBe("AUTH_REQUIRED");
    expect(result.authManagedByUser).toBe(true);
  });

  it("checkStatusHandler combines version and connectivity checks", async () => {
    const runner = makeRunner(async (args) => {
      if (args[0] === "--version") return { stdout: "1.5.2 (abc123)", stderr: "" };
      if (args[0] === "test") return { stdout: "Connection successful", stderr: "" };
      return { stdout: "", stderr: "" };
    });

    const result = (await checkStatusHandler(runner)) as any;
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.overall_status).toBe("ok");
    expect(result.structuredContent.version.compatibilityStatus).toBe("equal");
    expect(result.structuredContent.connectivity.status).toBe("ok");
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it("checkPassConnectivity returns generic error for non-auth failures", async () => {
    const runner = makeRunner(async () => {
      throw new Error("connection refused");
    });
    const result = await checkPassConnectivity(runner);

    expect(result.status).toBe("error");
    expect(result.message).toBe("connection refused");
    expect(result.authErrorCode).toBeUndefined();
    expect(result.authManagedByUser).toBeUndefined();
  });

  it("checkStatusHandler enriches structuredContent with auth error fields", async () => {
    const runner = makeRunner(async (args) => {
      if (args[0] === "--version") return { stdout: "1.5.2 (abc123)", stderr: "" };
      throw new PassCliAuthError("AUTH_EXPIRED");
    });

    const result = (await checkStatusHandler(runner)) as any;
    expect(result.isError).toBe(true);
    expect(result.structuredContent.overall_status).toBe("error");
    expect(result.structuredContent.error_code).toBe("AUTH_EXPIRED");
    expect(result.structuredContent.auth_managed_by_user).toBe(true);
    expect(result.structuredContent.retryable).toBeDefined();
  });

  it("checkStatusHandler reports warn when version is not parseable but connectivity ok", async () => {
    const runner = makeRunner(async (args) => {
      if (args[0] === "--version") return { stdout: "not-a-version", stderr: "" };
      if (args[0] === "test") return { stdout: "ok", stderr: "" };
      return { stdout: "", stderr: "" };
    });

    const result = (await checkStatusHandler(runner)) as any;
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.overall_status).toBe("warn");
    expect(result.structuredContent.version.compatibilityStatus).toBe("possibly_incompatible");
    expect(result.structuredContent.connectivity.status).toBe("ok");
  });

  it("checkStatusHandler allows local version drift override", async () => {
    const runner = makeRunner(async (args) => {
      if (args[0] === "--version") return { stdout: "0.9.0", stderr: "" };
      if (args[0] === "test") return { stdout: "ok", stderr: "" };
      return { stdout: "", stderr: "" };
    });

    const result = (await checkStatusHandler(runner, { allowVersionDrift: true })) as any;
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.overall_status).toBe("ok");
    expect(result.structuredContent.version.compatibilityStatus).toBe("compatible");
    expect(result.structuredContent.version.allowVersionDrift).toBe(true);
  });

  it("parseSemver handles edge cases", () => {
    expect(parseSemver("0.0.0")).toEqual({ major: 0, minor: 0, patch: 0 });
    expect(parseSemver("999999999999999999.0.0")).toBeNull();
    expect(parseSemver("1.5")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });

  it("viewUserInfoHandler forwards output format", async () => {
    const runner = makeRunner({ stdout: '{"email":"user@proton.me"}', stderr: "" });
    const result = await viewUserInfoHandler(runner, { output: "json" });

    expect(runner).toHaveBeenCalledWith(["user", "info", "--output", "json"]);
    expect(result.content[0].text).toContain('"email": "user@proton.me"');
  });

  it("listVaultsHandler requests output format", async () => {
    const runner = makeRunner({ stdout: '{"vaults":1}', stderr: "" });
    const result = await listVaultsHandler(runner, { output: "json" });

    expect(runner).toHaveBeenCalledWith(["vault", "list", "--output", "json"]);
    expect(result.content[0].text).toContain('"vaults": 1');
  });

  it("listSharesHandler supports vault/item filters and output format", async () => {
    const runner = makeRunner({ stdout: '{"shares":[]}', stderr: "" });
    const result = await listSharesHandler(runner, { onlyVaults: true, output: "json" });

    expect(runner).toHaveBeenCalledWith(["share", "list", "--output", "json", "--vaults"]);
    expect(result.content[0].text).toContain('"shares"');
  });

  it("listSharesHandler rejects conflicting selectors", async () => {
    const runner = makeRunner({ stdout: "", stderr: "" });

    await expect(
      listSharesHandler(runner, {
        onlyItems: true,
        onlyVaults: true,
        output: "json",
      }),
    ).rejects.toThrow("onlyItems and onlyVaults are mutually exclusive");
  });

  it("viewSettingsHandler returns parsed structuredContent from JSON output", async () => {
    const runner = makeRunner({
      stdout: '{"default_vault":"shr_123","default_format":"json"}',
      stderr: "",
    });

    const result = (await viewSettingsHandler(runner)) as any;

    expect(runner).toHaveBeenCalledWith(["settings", "view"]);
    expect(result.structuredContent).toEqual({
      settings: { default_vault: "shr_123", default_format: "json" },
    });
  });

  it("viewSettingsHandler parses key-value text output", async () => {
    const runner = makeRunner({
      stdout: "Default vault: shr_abc\nDefault format: human\n",
      stderr: "",
    });

    const result = (await viewSettingsHandler(runner)) as any;

    expect(result.structuredContent).toEqual({
      settings: {
        default_vault: "shr_abc",
        default_format: "human",
      },
      rawText: "Default vault: shr_abc\nDefault format: human",
    });
  });

  it("listInvitesHandler paginates and normalizes invite refs", async () => {
    const payload = {
      invites: [
        {
          invite_id: "inv-1",
          invite_type: "vault",
          resource_name: "Team Vault",
          inviter_email: "owner@example.com",
          role: "viewer",
          status: "pending",
          create_time: "2026-03-01T00:00:00Z",
          token: "sensitive-token-value",
        },
        {
          id: "inv-2",
          type: "item",
          name: "GitHub",
        },
      ],
    };

    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });
    const result = (await listInvitesHandler(runner, {
      pageSize: 1,
      cursor: "1",
    })) as any;
    const structured = result.structuredContent;

    expect(runner).toHaveBeenCalledWith(["invite", "list", "--output", "json"]);
    expect(structured.cursor).toBe("1");
    expect(structured.pageSize).toBe(1);
    expect(structured.total).toBe(2);
    expect(structured.returned).toBe(1);
    expect(structured.nextCursor).toBeNull();
    expect(structured.items[0]).toEqual({
      id: "inv-2",
      type: "item",
      target_name: "GitHub",
      inviter: null,
      role: null,
      state: null,
      create_time: null,
    });
    expect(structured.items[0].token).toBeUndefined();
  });

  it("listInvitesHandler rejects invalid cursor", async () => {
    const runner = makeRunner({ stdout: '{"invites":[]}', stderr: "" });

    await expect(
      listInvitesHandler(runner, {
        cursor: "abc",
      }),
    ).rejects.toThrow("Invalid cursor");
  });

  it("listInvitesHandler falls back to text for non-json output", async () => {
    const runner = makeRunner({ stdout: "not-json", stderr: "" });

    const result = await listInvitesHandler(runner, {});
    expect(result).toEqual({ content: [{ type: "text", text: "not-json" }] });
  });

  it("listInvitesHandler does not expose raw invite token as an identifier", async () => {
    const runner = makeRunner({
      stdout: '{"invites":[{"token":"sensitive-token-value"}]}',
      stderr: "",
    });

    const result = (await listInvitesHandler(runner, {})) as any;
    expect(result.structuredContent.items[0].id).toBe("invite-1");
  });

  it("listVaultMembersHandler validates selector exclusivity and paginates refs", async () => {
    const payload = {
      members: [
        {
          member_share_id: "mem-1",
          username: "alice",
          email: "alice@example.com",
          role: "manager",
          state: "active",
          create_time: "2026-03-01T00:00:00Z",
        },
        {
          id: "mem-2",
          name: "bob",
          user_email: "bob@example.com",
          share_role: "viewer",
        },
      ],
    };

    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    await expect(
      listVaultMembersHandler(runner, {
        shareId: "s1",
        vaultName: "Work",
      }),
    ).rejects.toThrow("Provide exactly one of shareId or vaultName");

    const result = (await listVaultMembersHandler(runner, {
      shareId: "s1",
      pageSize: 1,
      cursor: "1",
    })) as any;
    const structured = result.structuredContent;

    expect(runner).toHaveBeenCalledWith([
      "vault",
      "member",
      "list",
      "--share-id",
      "s1",
      "--output",
      "json",
    ]);
    expect(structured.scope).toEqual({ shareId: "s1" });
    expect(structured.pageSize).toBe(1);
    expect(structured.total).toBe(2);
    expect(structured.returned).toBe(1);
    expect(structured.nextCursor).toBeNull();
    expect(structured.items[0]).toEqual({
      id: "mem-2",
      username: "bob",
      email: "bob@example.com",
      role: "viewer",
      state: null,
      create_time: null,
    });
  });

  it("listVaultMembersHandler falls back to text for non-json output", async () => {
    const runner = makeRunner({ stdout: "not-json", stderr: "" });

    const result = await listVaultMembersHandler(runner, {
      shareId: "s1",
    });
    expect(result).toEqual({ content: [{ type: "text", text: "not-json" }] });
  });

  it("listItemsHandler rejects conflicting selectors", async () => {
    const runner = makeRunner();
    await expect(
      listItemsHandler(runner, { vaultName: "work", shareId: "abc", output: "json" }),
    ).rejects.toThrow("Provide only one of vaultName or shareId");
  });

  it("listItemsHandler requires a scope selector", async () => {
    const runner = makeRunner();
    await expect(listItemsHandler(runner, { output: "json" })).rejects.toThrow(
      "Provide exactly one of vaultName or shareId",
    );
  });

  it("listItemsHandler supports share-id and vault selector modes", async () => {
    const runner = makeRunner({ stdout: "[]", stderr: "" });

    await listItemsHandler(runner, {
      shareId: "s1",
      filterType: "login",
      filterState: "active",
      sortBy: "created-desc",
      output: "json",
    });
    await listItemsHandler(runner, { vaultName: "Work", output: "human" });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "item",
      "list",
      "--share-id",
      "s1",
      "--filter-type",
      "login",
      "--filter-state",
      "active",
      "--sort-by",
      "created-desc",
      "--output",
      "json",
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, ["item", "list", "--output", "human", "--", "Work"]);
  });

  it("listItemsHandler paginates json output by default with item refs only", async () => {
    const payload = Array.from({ length: 130 }, (_, i) => ({
      id: `item-${i + 1}`,
      share_id: "share-1",
      vault_id: "vault-1",
      state: "active",
      create_time: "2026-01-01T00:00:00Z",
      modify_time: "2026-01-02T00:00:00Z",
      content: {
        title: `Title ${i + 1}`,
        password: "super-secret-value",
      },
    }));
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    const result = await listItemsHandler(runner, { shareId: "s1", output: "json" });
    const structured = (result as any).structuredContent;

    expect(structured).toBeTruthy();
    expect(structured.pageSize).toBe(100);
    expect(structured.cursor).toBe("0");
    expect(structured.returned).toBe(100);
    expect(structured.total).toBe(130);
    expect(structured.nextCursor).toBe("100");
    expect(structured.items).toHaveLength(100);
    expect(structured.items[0]).toEqual({
      id: "item-1",
      share_id: "share-1",
      vault_id: "vault-1",
      type: null,
      title: "Title 1",
      display_title: "Title 1",
      state: "active",
      create_time: "2026-01-01T00:00:00Z",
      modify_time: "2026-01-02T00:00:00Z",
      uri: "pass://share-1/item-1",
    });
    expect(structured.items[99].title).toBe("Title 100");
    expect(structured.items[0].password).toBeUndefined();
  });

  it("listItemsHandler supports cursor and pageSize for follow-up pages", async () => {
    const payload = Array.from({ length: 75 }, (_, i) => ({
      id: `item-${i + 1}`,
      share_id: "s1",
    }));
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    const result = await listItemsHandler(runner, {
      shareId: "s1",
      output: "json",
      pageSize: 20,
      cursor: "40",
    });
    const structured = (result as any).structuredContent;

    expect(structured.pageSize).toBe(20);
    expect(structured.cursor).toBe("40");
    expect(structured.returned).toBe(20);
    expect(structured.total).toBe(75);
    expect(structured.nextCursor).toBe("60");
    expect(structured.items).toHaveLength(20);
    expect(structured.items[0].id).toEqual("item-41");
    expect(structured.items[19].id).toEqual("item-60");
    expect(structured.items[0].uri).toEqual("pass://s1/item-41");
  });

  it("listItemsHandler normalizes object payload shape with nested fields", async () => {
    const payload = {
      items: [
        {
          item_id: "i-1",
          share: { id: "share-1" },
          vault: { id: "vault-1" },
          create_time: "2026-01-01T00:00:00Z",
          modify_time: "2026-01-02T00:00:00Z",
          content: {},
        },
      ],
    };
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    const result = await listItemsHandler(runner, { shareId: "s1", output: "json" });
    const [item] = (result as any).structuredContent.items;

    expect(item).toEqual({
      id: "i-1",
      share_id: "share-1",
      vault_id: "vault-1",
      type: null,
      title: null,
      display_title: "[untitled:i-1]",
      state: null,
      create_time: "2026-01-01T00:00:00Z",
      modify_time: "2026-01-02T00:00:00Z",
      uri: "pass://share-1/i-1",
    });
  });

  it("listItemsHandler extracts normalized item type from content.content.<Type>", async () => {
    const payload = [
      {
        id: "i-login",
        share_id: "s1",
        content: { title: "GitHub", content: { Login: { username: "u", password: "secret" } } },
      },
      {
        id: "i-credit",
        share_id: "s1",
        content: { title: "Card", content: { CreditCard: { number: "4111..." } } },
      },
      {
        id: "i-ssh",
        share_id: "s1",
        content: { title: "Key", content: { SSHKey: { private_key: "..." } } },
      },
    ];

    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });
    const result = await listItemsHandler(runner, { shareId: "s1", output: "json" });
    const items = (result as any).structuredContent.items;

    expect(items[0].type).toBe("login");
    expect(items[1].type).toBe("credit-card");
    expect(items[2].type).toBe("ssh-key");
    expect(items[0].password).toBeUndefined();
  });

  it("listItemsHandler ignores camelCase metadata keys in item list payload", async () => {
    const payload = [
      {
        id: "i-camel",
        shareId: "s-camel",
        vaultId: "v-camel",
        createTime: "2026-01-01T00:00:00Z",
        modifyTime: "2026-01-02T00:00:00Z",
        state: "Active",
        content: { title: "Camel Case Item", content: { Login: { password: "secret" } } },
      },
    ];

    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });
    const result = await listItemsHandler(runner, { shareId: "s1", output: "json" });
    const [item] = (result as any).structuredContent.items;

    expect(item).toEqual({
      id: "i-camel",
      share_id: null,
      vault_id: null,
      type: "login",
      title: "Camel Case Item",
      display_title: "Camel Case Item",
      state: "Active",
      create_time: null,
      modify_time: null,
      uri: null,
    });
    expect(item.password).toBeUndefined();
  });

  it("listItemsHandler normalizes unknown typed content keys to kebab-case", async () => {
    const payload = [
      {
        id: "i-unknown-type",
        share_id: "s1",
        content: {
          title: "Unknown Type",
          content: { MyCustomType: { opaque: "value" } },
        },
      },
    ];

    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });
    const result = await listItemsHandler(runner, { shareId: "s1", output: "json" });
    const [item] = (result as any).structuredContent.items;

    expect(item.type).toBe("my-custom-type");
  });

  it("listItemsHandler rejects invalid cursor values", async () => {
    const runner = makeRunner({ stdout: "[]", stderr: "" });

    await expect(
      listItemsHandler(runner, {
        shareId: "s1",
        output: "json",
        cursor: "abc",
      }),
    ).rejects.toThrow("Invalid cursor");
  });

  it("listItemsHandler rejects pagination params for human output", async () => {
    const runner = makeRunner({ stdout: "ok", stderr: "" });

    await expect(
      listItemsHandler(runner, {
        shareId: "s1",
        output: "human",
        pageSize: 10,
      }),
    ).rejects.toThrow('Pagination is supported only with {"output":"json"}');
  });

  it("searchItemsHandler filters by title and returns paged item refs", async () => {
    const payload = [
      { id: "i-1", share_id: "s1", content: { title: "GitHub" } },
      { id: "i-2", share_id: "s1", content: { title: "GitLab" } },
      { id: "i-3", share_id: "s1", content: { title: "Jira" } },
      { id: "i-4", share_id: "s1", content: { password: "secret" } },
    ];
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    const result = await searchItemsHandler(runner, {
      query: "git",
      field: "title",
      match: "contains",
      caseSensitive: false,
      shareId: "s1",
      pageSize: 1,
      cursor: "1",
    });
    const structured = (result as any).structuredContent;

    expect(runner).toHaveBeenCalledWith(["item", "list", "--share-id", "s1", "--output", "json"]);
    expect(structured.total).toBe(2);
    expect(structured.returned).toBe(1);
    expect(structured.nextCursor).toBeNull();
    expect(structured.queryMeta).toEqual({
      field: "title",
      match: "contains",
      caseSensitive: false,
    });
    expect(structured.items[0]).toMatchObject({
      id: "i-2",
      title: "GitLab",
      display_title: "GitLab",
      uri: "pass://s1/i-2",
    });
    expect(structured.items[0].password).toBeUndefined();
  });

  it("searchItemsHandler supports exact case-sensitive matching and passthrough filters", async () => {
    const payload = [
      { id: "i-1", share_id: "s1", content: { title: "GitHub" } },
      { id: "i-2", share_id: "s1", content: { title: "github" } },
    ];
    const runner = makeRunner({ stdout: JSON.stringify({ items: payload }), stderr: "" });

    const result = await searchItemsHandler(runner, {
      query: "GitHub",
      field: "title",
      match: "exact",
      caseSensitive: true,
      vaultName: "Work",
      filterType: "login",
      filterState: "active",
      sortBy: "created-desc",
    });
    const structured = (result as any).structuredContent;

    expect(runner).toHaveBeenCalledWith([
      "item",
      "list",
      "--filter-type",
      "login",
      "--filter-state",
      "active",
      "--sort-by",
      "created-desc",
      "--output",
      "json",
      "--",
      "Work",
    ]);
    expect(structured.total).toBe(1);
    expect(structured.items[0].id).toBe("i-1");
  });

  it("searchItemsHandler rejects conflicting selectors", async () => {
    const runner = makeRunner({ stdout: "[]", stderr: "" });

    await expect(
      searchItemsHandler(runner, {
        query: "x",
        field: "title",
        match: "contains",
        caseSensitive: false,
        shareId: "s1",
        vaultName: "Work",
      }),
    ).rejects.toThrow("Provide only one of vaultName or shareId");
  });

  it("viewItemHandler validates selector combinations", async () => {
    const runner = makeRunner();

    await expect(viewItemHandler(runner, { output: "json" })).rejects.toThrow(
      "Provide either uri OR",
    );

    await expect(
      viewItemHandler(runner, {
        uri: "pass://a/b/c",
        shareId: "s",
        itemId: "i",
        output: "json",
      }),
    ).rejects.toThrow("uri is mutually exclusive");

    await expect(
      viewItemHandler(runner, {
        shareId: "s",
        vaultName: "v",
        itemId: "i",
        output: "json",
      }),
    ).rejects.toThrow("shareId and vaultName are mutually exclusive");

    await expect(
      viewItemHandler(runner, {
        shareId: "s",
        itemId: "i",
        itemTitle: "t",
        output: "json",
      }),
    ).rejects.toThrow("itemId and itemTitle are mutually exclusive");
  });

  it("viewItemHandler builds uri and selector argument modes", async () => {
    const runner = makeRunner({ stdout: '{"ok":true}', stderr: "" });

    await viewItemHandler(runner, {
      uri: "pass://Work/GitHub/password",
      output: "json",
    });

    await viewItemHandler(runner, {
      vaultName: "Work",
      itemTitle: "GitHub",
      field: "password",
      output: "human",
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "item",
      "view",
      "--output",
      "json",
      "--",
      "pass://Work/GitHub/password",
    ]);

    expect(runner).toHaveBeenNthCalledWith(2, [
      "item",
      "view",
      "--vault-name",
      "Work",
      "--item-title",
      "GitHub",
      "--field",
      "password",
      "--output",
      "human",
    ]);
  });

  it("itemTotpHandler validates selector combinations and builds arguments", async () => {
    const runner = makeRunner({ stdout: '{"totp":"123456"}', stderr: "" });

    await expect(itemTotpHandler(runner, { output: "json" })).rejects.toThrow(
      "Provide either uri OR",
    );

    await expect(
      itemTotpHandler(runner, {
        uri: "pass://a/b/totp",
        shareId: "s",
        itemId: "i",
        output: "json",
      }),
    ).rejects.toThrow("uri is mutually exclusive");

    await itemTotpHandler(runner, {
      uri: "pass://Work/GitHub/totp",
      output: "json",
    });

    await itemTotpHandler(runner, {
      vaultName: "Work",
      itemTitle: "GitHub",
      field: "totp",
      output: "human",
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "item",
      "totp",
      "--output",
      "json",
      "--",
      "pass://Work/GitHub/totp",
    ]);

    expect(runner).toHaveBeenNthCalledWith(2, [
      "item",
      "totp",
      "--vault-name",
      "Work",
      "--item-title",
      "GitHub",
      "--field",
      "totp",
      "--output",
      "human",
    ]);
  });

  it("password handlers build expected command arguments", async () => {
    const runner = makeRunner(async (args) => {
      if (args[0] === "password" && args[1] === "score") {
        return { stdout: '{"password_score":"Strong"}', stderr: "" };
      }
      return { stdout: "generated-value\n", stderr: "" };
    });

    const randomResult = await generateRandomPasswordHandler(runner, {
      length: 20,
      numbers: true,
      uppercase: true,
      symbols: false,
    });
    const passphraseResult = await generatePassphraseHandler(runner, {
      count: 4,
      separator: "hyphens",
      capitalize: true,
      numbers: true,
    });
    const scoreResult = await scorePasswordHandler(runner, {
      password: "MySecureP@ssw0rd",
      output: "json",
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "password",
      "generate",
      "random",
      "--length",
      "20",
      "--numbers",
      "true",
      "--uppercase",
      "true",
      "--symbols",
      "false",
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, [
      "password",
      "generate",
      "passphrase",
      "--count",
      "4",
      "--separator",
      "hyphens",
      "--capitalize",
      "true",
      "--numbers",
      "true",
    ]);
    expect(runner).toHaveBeenNthCalledWith(3, [
      "password",
      "score",
      "MySecureP@ssw0rd",
      "--output",
      "json",
    ]);

    expect(randomResult).toEqual({ content: [{ type: "text", text: "generated-value" }] });
    expect(passphraseResult).toEqual({ content: [{ type: "text", text: "generated-value" }] });
    expect(scoreResult).toEqual({
      content: [{ type: "text", text: '{\n  "password_score": "Strong"\n}' }],
    });
  });
});

describe("write handlers", () => {
  it("createVaultHandler enforces gate and falls back to OK", async () => {
    const runner = makeRunner({ stdout: "", stderr: "" });

    process.env.ALLOW_WRITE = "1";
    await expect(createVaultHandler(runner, { name: "Vault", confirm: false })).rejects.toThrow(
      "explicit confirmation",
    );

    const result = await createVaultHandler(runner, { name: "Vault", confirm: true });

    expect(runner).toHaveBeenCalledWith(["vault", "create", "--name", "Vault"]);
    expect(result).toEqual({ content: [{ type: "text", text: "OK" }] });
  });

  it("updateVaultHandler validates selector exclusivity and supports both modes", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "updated", stderr: "" });

    await expect(
      updateVaultHandler(runner, {
        newName: "X",
        confirm: true,
      }),
    ).rejects.toThrow("exactly one");

    await updateVaultHandler(runner, {
      shareId: "s1",
      newName: "Renamed",
      confirm: true,
    });

    await updateVaultHandler(runner, {
      vaultName: "Work",
      newName: "Renamed2",
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "vault",
      "update",
      "--share-id",
      "s1",
      "--name",
      "Renamed",
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, [
      "vault",
      "update",
      "--vault-name",
      "Work",
      "--name",
      "Renamed2",
    ]);
  });

  it("deleteVaultHandler validates selector exclusivity and supports both modes", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "deleted", stderr: "" });

    await expect(deleteVaultHandler(runner, { confirm: true })).rejects.toThrow("exactly one");

    await deleteVaultHandler(runner, { shareId: "s1", confirm: true });
    await deleteVaultHandler(runner, { vaultName: "Work", confirm: true });

    expect(runner).toHaveBeenNthCalledWith(1, ["vault", "delete", "--share-id", "s1"]);
    expect(runner).toHaveBeenNthCalledWith(2, ["vault", "delete", "--vault-name", "Work"]);
  });

  it("shareVaultHandler validates scope and supports optional role", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "shared", stderr: "" });

    await expect(
      shareVaultHandler(runner, {
        email: "user@example.com",
        confirm: true,
      }),
    ).rejects.toThrow("exactly one");

    await shareVaultHandler(runner, {
      shareId: "s1",
      email: "user@example.com",
      confirm: true,
    });

    await shareVaultHandler(runner, {
      vaultName: "Work",
      email: "manager@example.com",
      role: "manager",
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "vault",
      "share",
      "--share-id",
      "s1",
      "user@example.com",
    ]);

    expect(runner).toHaveBeenNthCalledWith(2, [
      "vault",
      "share",
      "--vault-name",
      "Work",
      "manager@example.com",
      "--role",
      "manager",
    ]);
  });

  it("transferVaultHandler validates scope and forwards target member share ID", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "transferred", stderr: "" });

    await expect(
      transferVaultHandler(runner, {
        memberShareId: "m1",
        confirm: true,
      }),
    ).rejects.toThrow("exactly one");

    await transferVaultHandler(runner, {
      shareId: "s1",
      memberShareId: "m1",
      confirm: true,
    });

    expect(runner).toHaveBeenCalledWith(["vault", "transfer", "--share-id", "s1", "m1"]);
  });

  it("vault member write handlers validate scope and build command arguments", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "ok", stderr: "" });

    await expect(
      updateVaultMemberHandler(runner, {
        memberShareId: "m1",
        role: "editor",
        confirm: true,
      }),
    ).rejects.toThrow("exactly one");

    await updateVaultMemberHandler(runner, {
      shareId: "s1",
      memberShareId: "m1",
      role: "manager",
      confirm: true,
    });

    await removeVaultMemberHandler(runner, {
      vaultName: "Work",
      memberShareId: "m2",
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "vault",
      "member",
      "update",
      "--share-id",
      "s1",
      "--member-share-id",
      "m1",
      "--role",
      "manager",
    ]);

    expect(runner).toHaveBeenNthCalledWith(2, [
      "vault",
      "member",
      "remove",
      "--vault-name",
      "Work",
      "--member-share-id",
      "m2",
    ]);
  });

  it("createLoginItemHandler handles selector conflicts and generate-password modes", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: '{"id":"1"}', stderr: "" });

    await expect(
      createLoginItemHandler(runner, {
        shareId: "s1",
        vaultName: "Work",
        title: "GitHub",
        output: "json",
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await createLoginItemHandler(runner, {
      shareId: "s1",
      title: "GitHub",
      generatePassword: "true",
      output: "json",
      confirm: true,
    });

    await createLoginItemHandler(runner, {
      vaultName: "Work",
      title: "GitLab",
      username: "user",
      email: "u@example.com",
      password: "p",
      url: "https://example.com",
      generatePassword: "length=20",
      output: "human",
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "item",
      "create",
      "login",
      "--share-id",
      "s1",
      "--title",
      "GitHub",
      "--generate-password",
      "--output",
      "json",
    ]);

    expect(runner).toHaveBeenNthCalledWith(2, [
      "item",
      "create",
      "login",
      "--vault-name",
      "Work",
      "--title",
      "GitLab",
      "--username",
      "user",
      "--email",
      "u@example.com",
      "--password",
      "p",
      "--url",
      "https://example.com",
      "--generate-password=length=20",
      "--output",
      "human",
    ]);
  });

  it("createLoginItemFromTemplateHandler validates selector conflicts and forwards stdin", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: '{"ok":true}', stderr: "" });

    await expect(
      createLoginItemFromTemplateHandler(runner, {
        shareId: "s1",
        vaultName: "Work",
        template: { title: "Demo", urls: ["https://example.com"] },
        output: "json",
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await createLoginItemFromTemplateHandler(runner, {
      shareId: "s1",
      template: { title: "Demo", urls: ["https://example.com"] },
      output: "json",
      confirm: true,
    });

    expect(runner).toHaveBeenCalledWith(
      ["item", "create", "login", "--from-template", "-", "--share-id", "s1", "--output", "json"],
      '{"title":"Demo","urls":["https://example.com"]}',
    );

    await createLoginItemFromTemplateHandler(runner, {
      vaultName: "Work",
      template: { title: "Demo", urls: ["https://example.com"] },
      output: "human",
      confirm: true,
    });

    expect(runner).toHaveBeenLastCalledWith(
      [
        "item",
        "create",
        "login",
        "--from-template",
        "-",
        "--vault-name",
        "Work",
        "--output",
        "human",
      ],
      '{"title":"Demo","urls":["https://example.com"]}',
    );
  });

  it("createNote/CreditCard/Wifi handlers validate scope and build command arguments", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: '{"ok":true}', stderr: "" });

    await expect(
      createNoteItemHandler(runner, {
        shareId: "s1",
        vaultName: "Work",
        title: "Note",
        note: "body",
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await createNoteItemHandler(runner, {
      shareId: "s1",
      title: "Note",
      note: "body",
      confirm: true,
    });

    await createCreditCardItemHandler(runner, {
      vaultName: "Work",
      title: "Card",
      cardholderName: "A U Thor",
      number: "4111111111111111",
      cvv: "123",
      expirationDate: "2027-12",
      pin: "0000",
      note: "Demo",
      confirm: true,
    });

    await createWifiItemHandler(runner, {
      shareId: "s1",
      title: "Cafe WiFi",
      ssid: "Cafe",
      password: "",
      security: "open",
      note: "Guest",
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "item",
      "create",
      "note",
      "--share-id",
      "s1",
      "--title",
      "Note",
      "--note",
      "body",
    ]);

    expect(runner).toHaveBeenNthCalledWith(2, [
      "item",
      "create",
      "credit-card",
      "--vault-name",
      "Work",
      "--title",
      "Card",
      "--cardholder-name",
      "A U Thor",
      "--number",
      "4111111111111111",
      "--cvv",
      "123",
      "--expiration-date",
      "2027-12",
      "--pin",
      "0000",
      "--note",
      "Demo",
    ]);

    expect(runner).toHaveBeenNthCalledWith(3, [
      "item",
      "create",
      "wifi",
      "--share-id",
      "s1",
      "--title",
      "Cafe WiFi",
      "--ssid",
      "Cafe",
      "--password",
      "",
      "--security",
      "open",
      "--note",
      "Guest",
    ]);
  });

  it("createCustom/Identity handlers validate scope and forward template stdin", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: '{"ok":true}', stderr: "" });

    await expect(
      createCustomItemHandler(runner, {
        shareId: "s1",
        vaultName: "Work",
        template: { title: "Custom 1" },
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await createCustomItemHandler(runner, {
      shareId: "s1",
      template: { title: "Custom 1", note: null },
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(
      1,
      ["item", "create", "custom", "--from-template", "-", "--share-id", "s1"],
      '{"title":"Custom 1","note":null}',
    );

    await createIdentityItemHandler(runner, {
      vaultName: "Work",
      template: { title: "Identity 1", first_name: "Ada", work_email: null },
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(
      2,
      ["item", "create", "identity", "--from-template", "-", "--vault-name", "Work"],
      '{"title":"Identity 1","first_name":"Ada","work_email":null}',
    );
  });

  it("updateItemHandler validates selectors and builds field arguments", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "", stderr: "updated" });

    await expect(
      updateItemHandler(runner, {
        shareId: "s",
        vaultName: "v",
        itemId: "i",
        fields: ["password=1"],
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await expect(
      updateItemHandler(runner, {
        itemId: "i",
        itemTitle: "t",
        fields: ["password=1"],
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of itemId or itemTitle");

    await expect(
      updateItemHandler(runner, {
        fields: ["password=1"],
        confirm: true,
      }),
    ).rejects.toThrow("Provide itemId or itemTitle");

    const resultById = await updateItemHandler(runner, {
      shareId: "s1",
      itemId: "i1",
      fields: ["password=abc", "username=u"],
      confirm: true,
    });

    const resultByTitle = await updateItemHandler(runner, {
      vaultName: "Work",
      itemTitle: "GitHub",
      fields: ["password=xyz"],
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "item",
      "update",
      "--share-id",
      "s1",
      "--item-id",
      "i1",
      "--field",
      "password=abc",
      "--field",
      "username=u",
    ]);

    expect(runner).toHaveBeenNthCalledWith(2, [
      "item",
      "update",
      "--vault-name",
      "Work",
      "--item-title",
      "GitHub",
      "--field",
      "password=xyz",
    ]);

    expect(resultById).toEqual({ content: [{ type: "text", text: "updated" }] });
    expect(resultByTitle).toEqual({ content: [{ type: "text", text: "updated" }] });
  });

  it("deleteItemHandler deletes and falls back to OK", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "", stderr: "" });

    const result = await deleteItemHandler(runner, {
      shareId: "s1",
      itemId: "i1",
      confirm: true,
    });

    expect(runner).toHaveBeenCalledWith(["item", "delete", "--share-id", "s1", "--item-id", "i1"]);
    expect(result).toEqual({ content: [{ type: "text", text: "OK" }] });
  });

  it("shareItemHandler forwards required and optional sharing fields", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "shared", stderr: "" });

    await shareItemHandler(runner, {
      shareId: "s1",
      itemId: "i1",
      email: "viewer@example.com",
      confirm: true,
    });
    await shareItemHandler(runner, {
      shareId: "s2",
      itemId: "i2",
      email: "editor@example.com",
      role: "editor",
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "item",
      "share",
      "--share-id",
      "s1",
      "--item-id",
      "i1",
      "viewer@example.com",
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, [
      "item",
      "share",
      "--share-id",
      "s2",
      "--item-id",
      "i2",
      "editor@example.com",
      "--role",
      "editor",
    ]);
  });

  it("createItemAliasHandler validates selectors and passes prefix/output", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: '{"alias":"demo"}', stderr: "" });

    await expect(
      createItemAliasHandler(runner, {
        shareId: "s1",
        vaultName: "Work",
        prefix: "demo",
        output: "json",
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await createItemAliasHandler(runner, {
      vaultName: "Work",
      prefix: "demo",
      output: "json",
      confirm: true,
    });

    expect(runner).toHaveBeenCalledWith([
      "item",
      "alias",
      "create",
      "--vault-name",
      "Work",
      "--prefix",
      "demo",
      "--output",
      "json",
    ]);
  });

  it("injectHandler enforces gate and forwards file/options", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "injected", stderr: "" });

    await expect(
      injectHandler(runner, {
        inFile: "template.env",
        confirm: false,
      }),
    ).rejects.toThrow("explicit confirmation");

    await injectHandler(runner, {
      inFile: "template.env",
      outFile: "rendered.env",
      fileMode: "0600",
      force: true,
      confirm: true,
    });

    expect(runner).toHaveBeenCalledWith([
      "inject",
      "--in-file",
      "template.env",
      "--out-file",
      "rendered.env",
      "--file-mode",
      "0600",
      "--force",
    ]);
  });

  it("runHandler enforces gate and builds env-file/no-masking command", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "ran", stderr: "" });

    await runHandler(runner, {
      command: ["node", "script.js", "--flag"],
      envFiles: ["base.env", "secrets.env"],
      noMasking: true,
      confirm: true,
    });

    expect(runner).toHaveBeenCalledWith([
      "run",
      "--env-file",
      "base.env",
      "--env-file",
      "secrets.env",
      "--no-masking",
      "--",
      "node",
      "script.js",
      "--flag",
    ]);
  });

  it("inviteAcceptHandler and inviteRejectHandler enforce gate and call invite commands", async () => {
    const runner = makeRunner({ stdout: "", stderr: "" });
    process.env.ALLOW_WRITE = "1";

    await expect(
      inviteAcceptHandler(runner, {
        inviteToken: "tok-accept",
        confirm: false,
      }),
    ).rejects.toThrow("explicit confirmation");

    await inviteAcceptHandler(runner, {
      inviteToken: "tok-accept",
      confirm: true,
    });

    await inviteRejectHandler(runner, {
      inviteToken: "tok-reject",
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, ["invite", "accept", "--invite-token", "tok-accept"]);
    expect(runner).toHaveBeenNthCalledWith(2, ["invite", "reject", "--invite-token", "tok-reject"]);
  });

  it("settings default-vault handlers enforce gate and call expected commands", async () => {
    const runner = makeRunner({ stdout: "", stderr: "" });
    process.env.ALLOW_WRITE = "1";

    await expect(
      settingsSetDefaultVaultHandler(runner, {
        shareId: "s1",
        vaultName: "Work",
        confirm: true,
      }),
    ).rejects.toThrow("Provide exactly one of shareId or vaultName");

    await settingsSetDefaultVaultHandler(runner, {
      vaultName: "Work",
      confirm: true,
    });
    await settingsUnsetDefaultVaultHandler(runner, {
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "settings",
      "set",
      "default-vault",
      "--vault-name",
      "Work",
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, ["settings", "unset", "default-vault"]);
  });
});

describe("server setup", () => {
  it("creates MCP server with all tool registrations", () => {
    const runner = makeRunner({ stdout: "", stderr: "" });
    const server = createServer({ runPassCli: runner });
    expect(server).toBeTruthy();
  });

  it("registers item template resources and serves JSON payloads", async () => {
    const runner = makeRunner({ stdout: "", stderr: "" });
    const server = createServer({ runPassCli: runner });

    const resources = (server as any)._registeredResources as Record<
      string,
      {
        readCallback: (uri: URL, extra: unknown) => Promise<{ contents: Array<{ text: string }> }>;
      }
    >;

    expect(resources["pass://templates/item-create"]).toBeDefined();
    expect(resources["pass://templates/item-create/login"]).toBeDefined();
    expect(resources["pass://templates/item-create/note"]).toBeDefined();
    expect(resources["pass://templates/item-create/credit-card"]).toBeDefined();
    expect(resources["pass://templates/item-create/wifi"]).toBeDefined();
    expect(resources["pass://templates/item-create/custom"]).toBeDefined();
    expect(resources["pass://templates/item-create/identity"]).toBeDefined();

    const indexResult = await resources["pass://templates/item-create"].readCallback(
      new URL("pass://templates/item-create"),
      {},
    );
    const indexText = indexResult.contents[0]?.text ?? "";
    const indexPayload = JSON.parse(indexText) as {
      template_types: string[];
      pass_cli_version: string;
    };
    expect(indexPayload.template_types).toEqual(
      expect.arrayContaining(["login", "note", "credit-card", "wifi", "custom", "identity"]),
    );
    expect(indexPayload.pass_cli_version).toContain("1.5.2");

    const loginResult = await resources["pass://templates/item-create/login"].readCallback(
      new URL("pass://templates/item-create/login"),
      {},
    );
    const loginText = loginResult.contents[0]?.text ?? "";
    const loginPayload = JSON.parse(loginText) as {
      template?: { title?: string; urls?: unknown[] };
    };
    expect(loginPayload.template?.title).toBeDefined();
    expect(Array.isArray(loginPayload.template?.urls)).toBe(true);
  });

  it("registered tool handlers are invocable from internal tool registry", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner(async (args) => {
      if (args[0] === "vault" && args[1] === "member") {
        return { stdout: '{"members":[]}', stderr: "" };
      }
      if (args[0] === "invite" && args[1] === "list") {
        return { stdout: '{"invites":[]}', stderr: "" };
      }
      if (args[0] === "settings" && args[1] === "view") {
        return { stdout: "Default vault: (none)\nDefault format: human", stderr: "" };
      }
      if (args[0] === "item" && args[1] === "list") {
        return { stdout: "[]", stderr: "" };
      }
      return { stdout: '{"ok":true}', stderr: "" };
    });
    const server = createServer({ runPassCli: runner });
    const tools = (server as any)._registeredTools as Record<
      string,
      { handler: (input?: any) => Promise<unknown> }
    >;

    await tools.view_session_info.handler();
    await tools.check_status.handler();
    await tools.inject.handler({ inFile: "template.env", confirm: true });
    await tools.run.handler({ command: ["echo", "hello"], confirm: true });
    await tools.view_user_info.handler({ output: "json" });
    await tools.view_settings.handler();
    await tools.set_default_vault.handler({ vaultName: "Sandbox", confirm: true });
    await tools.unset_default_vault.handler({ confirm: true });
    await tools.generate_random_password.handler({ length: 16, uppercase: true });
    await tools.generate_passphrase.handler({ count: 5, separator: "hyphens" });
    await tools.score_password.handler({ password: "MySecureP@ssw0rd", output: "json" });
    await tools.list_vaults.handler({ output: "json" });
    await tools.list_vault_members.handler({ shareId: "s1" });
    await tools.update_vault_member.handler({
      shareId: "s1",
      memberShareId: "m1",
      role: "editor",
      confirm: true,
    });
    await tools.remove_vault_member.handler({
      shareId: "s1",
      memberShareId: "m1",
      confirm: true,
    });
    await tools.share_vault.handler({
      shareId: "s1",
      email: "user@example.com",
      role: "viewer",
      confirm: true,
    });
    await tools.transfer_vault.handler({
      shareId: "s1",
      memberShareId: "m1",
      confirm: true,
    });
    await tools.create_vault.handler({ name: "Sandbox", confirm: true });
    await tools.update_vault.handler({ vaultName: "Sandbox", newName: "Sandbox 2", confirm: true });
    await tools.delete_vault.handler({ vaultName: "Sandbox", confirm: true });
    await tools.list_shares.handler({ output: "json" });
    await tools.list_invites.handler({});
    await tools.accept_invite.handler({ inviteToken: "tok-accept", confirm: true });
    await tools.reject_invite.handler({ inviteToken: "tok-reject", confirm: true });
    await tools.list_items.handler({ shareId: "s1", output: "json" });
    await tools.search_items.handler({
      query: "GitHub",
      field: "title",
      match: "contains",
      caseSensitive: false,
      shareId: "s1",
    });
    await tools.view_item.handler({ uri: "pass://Work/GitHub/password", output: "json" });
    await tools.generate_item_totp.handler({ uri: "pass://Work/GitHub/totp", output: "json" });
    await tools.create_login_item.handler({
      vaultName: "Sandbox",
      title: "GitHub",
      username: "octocat",
      password: "s3cr3t",
      output: "json",
      confirm: true,
    });
    await tools.create_login_item_from_template.handler({
      vaultName: "Sandbox",
      template: {
        title: "Demo Note",
        urls: ["https://example.com"],
      },
      output: "json",
      confirm: true,
    });
    await tools.create_note_item.handler({
      vaultName: "Sandbox",
      title: "Note 1",
      note: "demo",
      confirm: true,
    });
    await tools.create_credit_card_item.handler({
      shareId: "s1",
      title: "Card 1",
      number: "4111111111111111",
      expirationDate: "2027-12",
      confirm: true,
    });
    await tools.create_wifi_item.handler({
      shareId: "s1",
      title: "Wifi 1",
      ssid: "Guest",
      security: "open",
      confirm: true,
    });
    await tools.create_custom_item.handler({
      shareId: "s1",
      template: {
        title: "Custom 1",
        note: null,
      },
      confirm: true,
    });
    await tools.create_identity_item.handler({
      vaultName: "Sandbox",
      template: {
        title: "Identity 1",
        first_name: "Ada",
      },
      confirm: true,
    });
    await tools.update_item.handler({
      shareId: "s1",
      itemId: "i1",
      fields: ["password=updated"],
      confirm: true,
    });
    await tools.delete_item.handler({
      shareId: "s1",
      itemId: "i1",
      confirm: true,
    });
    await tools.share_item.handler({
      shareId: "s1",
      itemId: "i1",
      email: "user@example.com",
      role: "editor",
      confirm: true,
    });
    await tools.create_item_alias.handler({
      vaultName: "Sandbox",
      prefix: "demo",
      output: "json",
      confirm: true,
    });

    expect(tools.create_vault).toBeDefined();
    expect(tools.update_vault).toBeDefined();
    expect(tools.delete_vault).toBeDefined();
    expect(tools.accept_invite).toBeDefined();
    expect(tools.reject_invite).toBeDefined();
    expect(tools.set_default_vault).toBeDefined();
    expect(tools.unset_default_vault).toBeDefined();
    expect(tools.generate_random_password).toBeDefined();
    expect(tools.generate_passphrase).toBeDefined();
    expect(tools.score_password).toBeDefined();
    expect(tools.inject).toBeDefined();
    expect(tools.run).toBeDefined();
    expect(tools.update_vault_member).toBeDefined();
    expect(tools.remove_vault_member).toBeDefined();
    expect(tools.share_vault).toBeDefined();
    expect(tools.transfer_vault).toBeDefined();
    expect(tools.generate_item_totp).toBeDefined();
    expect(tools.create_login_item).toBeDefined();
    expect(tools.create_login_item_from_template).toBeDefined();
    expect(tools.create_note_item).toBeDefined();
    expect(tools.create_credit_card_item).toBeDefined();
    expect(tools.create_wifi_item).toBeDefined();
    expect(tools.create_custom_item).toBeDefined();
    expect(tools.create_identity_item).toBeDefined();
    expect(tools.update_item).toBeDefined();
    expect(tools.delete_item).toBeDefined();
    expect(tools.share_item).toBeDefined();
    expect(tools.create_item_alias).toBeDefined();

    expect(runner).toHaveBeenCalledTimes(40);
  });

  it("registered tool handlers return standardized auth error payloads", async () => {
    const runner = makeRunner(async () => {
      throw new PassCliAuthError("AUTH_REQUIRED");
    });
    const server = createServer({ runPassCli: runner });
    const tools = (server as any)._registeredTools as Record<
      string,
      { handler: (input?: any) => Promise<unknown> }
    >;

    const result = (await tools.view_session_info.handler()) as any;

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error_code: "AUTH_REQUIRED",
      retryable: true,
      auth_managed_by_user: true,
    });
    expect(result.content?.[0]?.text).toContain('Run "pass-cli login"');
  });

  it("startServer uses provided server, transport, and callback", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const onStarted = vi.fn();
    const fakeTransport = {} as any;

    await startServer({
      server: { connect },
      transport: fakeTransport,
      onStarted,
    });

    expect(connect).toHaveBeenCalledWith(fakeTransport);
    expect(onStarted).toHaveBeenCalledWith("started");
  });
});

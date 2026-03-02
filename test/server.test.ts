import { describe, it, expect, vi, afterEach } from "vitest";

import {
  asJsonTextOrRaw,
  checkPassCliVersion,
  checkPassConnectivity,
  classifyPassCliAuthErrorText,
  createRunPassCli,
  createServer,
  evaluatePassCliCompatibility,
  logErr,
  parseSemver,
  checkStatusHandler,
  PassCliAuthError,
  viewSessionInfoHandler,
  createItemFromTemplateHandler,
  createLoginItemHandler,
  deleteItemHandler,
  listItemsHandler,
  searchItemsHandler,
  updateItemHandler,
  viewItemHandler,
  viewUserInfoHandler,
  listSharesHandler,
  createVaultHandler,
  deleteVaultHandler,
  listVaultsHandler,
  updateVaultHandler,
  requireWriteGate,
  startServer,
  type PassCliResult,
  type PassCliRunner,
} from "../src/server.js";

const originalAllowWrite = process.env.ALLOW_WRITE;
const originalPassCliBin = process.env.PASS_CLI_BIN;
const originalPinnedVersion = process.env.PASS_CLI_PINNED_VERSION;

afterEach(() => {
  if (originalAllowWrite === undefined) delete process.env.ALLOW_WRITE;
  else process.env.ALLOW_WRITE = originalAllowWrite;

  if (originalPassCliBin === undefined) delete process.env.PASS_CLI_BIN;
  else process.env.PASS_CLI_BIN = originalPassCliBin;

  if (originalPinnedVersion === undefined) delete process.env.PASS_CLI_PINNED_VERSION;
  else process.env.PASS_CLI_PINNED_VERSION = originalPinnedVersion;

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
    ).toMatchObject({ compatibilityStatus: "warn" });
    expect(
      evaluatePassCliCompatibility(
        { major: 1, minor: 6, patch: 0 },
        { major: 1, minor: 5, patch: 2 },
      ),
    ).toMatchObject({ compatibilityStatus: "warn" });
    expect(
      evaluatePassCliCompatibility(
        { major: 1, minor: 4, patch: 9 },
        { major: 1, minor: 5, patch: 2 },
      ),
    ).toMatchObject({ compatibilityStatus: "error" });
    expect(
      evaluatePassCliCompatibility(
        { major: 2, minor: 0, patch: 0 },
        { major: 1, minor: 5, patch: 2 },
      ),
    ).toMatchObject({ compatibilityStatus: "error" });
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
    expect(stderrSpy).toHaveBeenCalledWith("[proton-pass-mcp] started\n");
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
    expect(result.detectedVersion).toBe("1.5.9");
    expect(result.compatibilityStatus).toBe("warn");
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
    expect(result.structuredContent.version.compatibilityStatus).toBe("ok");
    expect(result.structuredContent.connectivity.status).toBe("ok");
    expect(runner).toHaveBeenCalledTimes(2);
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
      sortBy: "modify_time",
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
      "modify_time",
      "--output",
      "json",
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, ["item", "list", "Work", "--output", "human"]);
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
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
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
      title: null,
      display_title: "[untitled:i-1]",
      state: null,
      create_time: "2026-01-01T00:00:00Z",
      modify_time: "2026-01-02T00:00:00Z",
      uri: "pass://share-1/i-1",
    });
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
      sortBy: "modify_time",
    });
    const structured = (result as any).structuredContent;

    expect(runner).toHaveBeenCalledWith([
      "item",
      "list",
      "Work",
      "--filter-type",
      "login",
      "--filter-state",
      "active",
      "--sort-by",
      "modify_time",
      "--output",
      "json",
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

  it("createItemFromTemplateHandler validates selector conflicts and forwards stdin", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: '{"ok":true}', stderr: "" });

    await expect(
      createItemFromTemplateHandler(runner, {
        itemType: "login",
        shareId: "s1",
        vaultName: "Work",
        templateJson: "{}",
        output: "json",
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await createItemFromTemplateHandler(runner, {
      itemType: "login",
      shareId: "s1",
      templateJson: '{"x":1}',
      output: "json",
      confirm: true,
    });

    expect(runner).toHaveBeenCalledWith(
      ["item", "create", "login", "--from-template", "-", "--share-id", "s1", "--output", "json"],
      '{"x":1}',
    );

    await createItemFromTemplateHandler(runner, {
      itemType: "login",
      vaultName: "Work",
      templateJson: "{}",
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
      "{}",
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
});

describe("server setup", () => {
  it("creates MCP server with all tool registrations", () => {
    const runner = makeRunner({ stdout: "", stderr: "" });
    const server = createServer({ runPassCli: runner });
    expect(server).toBeTruthy();
  });

  it("registered tool handlers are invocable from internal tool registry", async () => {
    const runner = makeRunner({ stdout: '{"ok":true}', stderr: "" });
    const server = createServer({ runPassCli: runner });
    const tools = (server as any)._registeredTools as Record<
      string,
      { handler: (input?: any) => Promise<unknown> }
    >;

    await tools.view_session_info.handler();
    await tools.check_status.handler();
    await tools.view_user_info.handler({ output: "json" });
    await tools.list_vaults.handler({ output: "json" });
    await tools.list_shares.handler({ output: "json" });
    await tools.list_items.handler({ shareId: "s1", output: "json" });
    await tools.search_items.handler({
      query: "GitHub",
      field: "title",
      match: "contains",
      caseSensitive: false,
      shareId: "s1",
    });
    await tools.view_item.handler({ uri: "pass://Work/GitHub/password", output: "json" });

    expect(tools.create_vault).toBeUndefined();
    expect(tools.update_vault).toBeUndefined();
    expect(tools.delete_vault).toBeUndefined();
    expect(tools.create_login_item).toBeUndefined();
    expect(tools.create_item_from_template).toBeUndefined();
    expect(tools.update_item).toBeUndefined();
    expect(tools.delete_item).toBeUndefined();

    expect(runner).toHaveBeenCalledTimes(9);
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

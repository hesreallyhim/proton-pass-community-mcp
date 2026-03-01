import { describe, it, expect, vi, afterEach } from "vitest";

import {
  asJsonTextOrRaw,
  createRunPassCli,
  createServer,
  logErr,
  passInfoHandler,
  passItemCreateFromTemplateHandler,
  passItemCreateLoginHandler,
  passItemDeleteHandler,
  passItemListHandler,
  passItemUpdateHandler,
  passItemViewHandler,
  passVaultCreateHandler,
  passVaultDeleteHandler,
  passVaultListHandler,
  passVaultUpdateHandler,
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

  it("logErr writes to stderr with server prefix", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    logErr("started");
    expect(stderrSpy).toHaveBeenCalledWith("[proton-pass-mcp] started\n");
  });
});

describe("read-only handlers", () => {
  it("passInfoHandler trims output", async () => {
    const runner = makeRunner({ stdout: " hello\n", stderr: "" });
    const result = await passInfoHandler(runner);

    expect(runner).toHaveBeenCalledWith(["info"]);
    expect(result).toEqual({ content: [{ type: "text", text: "hello" }] });
  });

  it("passVaultListHandler requests output format", async () => {
    const runner = makeRunner({ stdout: '{"vaults":1}', stderr: "" });
    const result = await passVaultListHandler(runner, { output: "json" });

    expect(runner).toHaveBeenCalledWith(["vault", "list", "--output", "json"]);
    expect(result.content[0].text).toContain('"vaults": 1');
  });

  it("passItemListHandler rejects conflicting selectors", async () => {
    const runner = makeRunner();
    await expect(
      passItemListHandler(runner, { vaultName: "work", shareId: "abc", output: "json" }),
    ).rejects.toThrow("Provide only one of vaultName or shareId");
  });

  it("passItemListHandler supports share-id and vault selector modes", async () => {
    const runner = makeRunner({ stdout: "[]", stderr: "" });

    await passItemListHandler(runner, { shareId: "s1", output: "json" });
    await passItemListHandler(runner, { vaultName: "Work", output: "human" });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "item",
      "list",
      "--share-id",
      "s1",
      "--output",
      "json",
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, ["item", "list", "Work", "--output", "human"]);
  });

  it("passItemListHandler paginates json output by default", async () => {
    const payload = Array.from({ length: 130 }, (_, i) => ({ id: `item-${i + 1}` }));
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    const result = await passItemListHandler(runner, { output: "json" });
    const structured = (result as any).structuredContent;

    expect(structured).toBeTruthy();
    expect(structured.pageSize).toBe(100);
    expect(structured.cursor).toBe("0");
    expect(structured.returned).toBe(100);
    expect(structured.total).toBe(130);
    expect(structured.nextCursor).toBe("100");
    expect(structured.items).toHaveLength(100);
    expect(structured.items[0]).toEqual({ id: "item-1" });
    expect(structured.items[99]).toEqual({ id: "item-100" });
  });

  it("passItemListHandler supports cursor and pageSize for follow-up pages", async () => {
    const payload = Array.from({ length: 75 }, (_, i) => ({ id: `item-${i + 1}` }));
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    const result = await passItemListHandler(runner, {
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
    expect(structured.items[0]).toEqual({ id: "item-41" });
    expect(structured.items[19]).toEqual({ id: "item-60" });
  });

  it("passItemListHandler rejects invalid cursor values", async () => {
    const runner = makeRunner({ stdout: "[]", stderr: "" });

    await expect(
      passItemListHandler(runner, {
        output: "json",
        cursor: "abc",
      }),
    ).rejects.toThrow("Invalid cursor");
  });

  it("passItemListHandler rejects pagination params for human output", async () => {
    const runner = makeRunner({ stdout: "ok", stderr: "" });

    await expect(
      passItemListHandler(runner, {
        output: "human",
        pageSize: 10,
      }),
    ).rejects.toThrow('Pagination is supported only with {"output":"json"}');
  });

  it("passItemViewHandler validates selector combinations", async () => {
    const runner = makeRunner();

    await expect(passItemViewHandler(runner, { output: "json" })).rejects.toThrow(
      "Provide either uri OR",
    );

    await expect(
      passItemViewHandler(runner, {
        uri: "pass://a/b/c",
        shareId: "s",
        itemId: "i",
        output: "json",
      }),
    ).rejects.toThrow("uri is mutually exclusive");

    await expect(
      passItemViewHandler(runner, {
        shareId: "s",
        vaultName: "v",
        itemId: "i",
        output: "json",
      }),
    ).rejects.toThrow("shareId and vaultName are mutually exclusive");

    await expect(
      passItemViewHandler(runner, {
        shareId: "s",
        itemId: "i",
        itemTitle: "t",
        output: "json",
      }),
    ).rejects.toThrow("itemId and itemTitle are mutually exclusive");
  });

  it("passItemViewHandler builds uri and selector argument modes", async () => {
    const runner = makeRunner({ stdout: '{"ok":true}', stderr: "" });

    await passItemViewHandler(runner, {
      uri: "pass://Work/GitHub/password",
      output: "json",
    });

    await passItemViewHandler(runner, {
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
  it("passVaultCreateHandler enforces gate and falls back to OK", async () => {
    const runner = makeRunner({ stdout: "", stderr: "" });

    process.env.ALLOW_WRITE = "1";
    await expect(passVaultCreateHandler(runner, { name: "Vault", confirm: false })).rejects.toThrow(
      "explicit confirmation",
    );

    const result = await passVaultCreateHandler(runner, { name: "Vault", confirm: true });

    expect(runner).toHaveBeenCalledWith(["vault", "create", "--name", "Vault"]);
    expect(result).toEqual({ content: [{ type: "text", text: "OK" }] });
  });

  it("passVaultUpdateHandler validates selector exclusivity and supports both modes", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "updated", stderr: "" });

    await expect(
      passVaultUpdateHandler(runner, {
        newName: "X",
        confirm: true,
      }),
    ).rejects.toThrow("exactly one");

    await passVaultUpdateHandler(runner, {
      shareId: "s1",
      newName: "Renamed",
      confirm: true,
    });

    await passVaultUpdateHandler(runner, {
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

  it("passVaultDeleteHandler validates selector exclusivity and supports both modes", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "deleted", stderr: "" });

    await expect(passVaultDeleteHandler(runner, { confirm: true })).rejects.toThrow("exactly one");

    await passVaultDeleteHandler(runner, { shareId: "s1", confirm: true });
    await passVaultDeleteHandler(runner, { vaultName: "Work", confirm: true });

    expect(runner).toHaveBeenNthCalledWith(1, ["vault", "delete", "--share-id", "s1"]);
    expect(runner).toHaveBeenNthCalledWith(2, ["vault", "delete", "--vault-name", "Work"]);
  });

  it("passItemCreateLoginHandler handles selector conflicts and generate-password modes", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: '{"id":"1"}', stderr: "" });

    await expect(
      passItemCreateLoginHandler(runner, {
        shareId: "s1",
        vaultName: "Work",
        title: "GitHub",
        output: "json",
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await passItemCreateLoginHandler(runner, {
      shareId: "s1",
      title: "GitHub",
      generatePassword: "true",
      output: "json",
      confirm: true,
    });

    await passItemCreateLoginHandler(runner, {
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

  it("passItemCreateFromTemplateHandler validates selector conflicts and forwards stdin", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: '{"ok":true}', stderr: "" });

    await expect(
      passItemCreateFromTemplateHandler(runner, {
        itemType: "login",
        shareId: "s1",
        vaultName: "Work",
        templateJson: "{}",
        output: "json",
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await passItemCreateFromTemplateHandler(runner, {
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

    await passItemCreateFromTemplateHandler(runner, {
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

  it("passItemUpdateHandler validates selectors and builds field arguments", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "", stderr: "updated" });

    await expect(
      passItemUpdateHandler(runner, {
        shareId: "s",
        vaultName: "v",
        itemId: "i",
        fields: ["password=1"],
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await expect(
      passItemUpdateHandler(runner, {
        itemId: "i",
        itemTitle: "t",
        fields: ["password=1"],
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of itemId or itemTitle");

    await expect(
      passItemUpdateHandler(runner, {
        fields: ["password=1"],
        confirm: true,
      }),
    ).rejects.toThrow("Provide itemId or itemTitle");

    const resultById = await passItemUpdateHandler(runner, {
      shareId: "s1",
      itemId: "i1",
      fields: ["password=abc", "username=u"],
      confirm: true,
    });

    const resultByTitle = await passItemUpdateHandler(runner, {
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

  it("passItemDeleteHandler deletes and falls back to OK", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "", stderr: "" });

    const result = await passItemDeleteHandler(runner, {
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
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: '{"ok":true}', stderr: "" });
    const server = createServer({ runPassCli: runner });
    const tools = (server as any)._registeredTools as Record<
      string,
      { handler: (input?: any) => Promise<unknown> }
    >;

    await tools.pass_info.handler();
    await tools.pass_vault_list.handler({ output: "json" });
    await tools.pass_item_list.handler({ output: "json" });
    await tools.pass_item_view.handler({ uri: "pass://Work/GitHub/password", output: "json" });
    await tools.pass_vault_create.handler({ name: "Vault", confirm: true });
    await tools.pass_vault_update.handler({ shareId: "s1", newName: "Renamed", confirm: true });
    await tools.pass_vault_delete.handler({ shareId: "s1", confirm: true });
    await tools.pass_item_create_login.handler({
      shareId: "s1",
      title: "GitHub",
      output: "json",
      confirm: true,
    });
    await tools.pass_item_create_from_template.handler({
      itemType: "login",
      shareId: "s1",
      templateJson: "{}",
      output: "json",
      confirm: true,
    });
    await tools.pass_item_update.handler({
      shareId: "s1",
      itemId: "i1",
      fields: ["password=abc"],
      confirm: true,
    });
    await tools.pass_item_delete.handler({ shareId: "s1", itemId: "i1", confirm: true });

    expect(runner).toHaveBeenCalledTimes(11);
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

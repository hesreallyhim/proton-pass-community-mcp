import { afterEach, describe, expect, it, vi } from "vitest";

import { createServer, PassCliAuthError, startServer } from "../../src/server.js";

import { makeRunner, restoreProcessEnvAndMocks } from "./test-support.js";

afterEach(restoreProcessEnvAndMocks);

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
    await tools.support.handler();
    await tools.inject.handler({ inFile: "template.env", confirm: true });
    await tools.run.handler({ command: ["echo", "hello"], confirm: true });
    await tools.view_user_info.handler({ output: "json" });
    await tools.view_settings.handler();
    await tools.set_default_vault.handler({ vaultName: "Sandbox", confirm: true });
    await tools.unset_default_vault.handler({ confirm: true });
    await tools.generate_random_password.handler({ length: 16, uppercase: true });
    await tools.generate_passphrase.handler({ count: 5, separator: "hyphens" });
    await tools.score_password.handler({ password: "MySecureP@ssw0rd", output: "json" });
    await tools.generate_totp.handler({
      secretOrUri: "otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP",
      output: "json",
    });
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
    await tools.move_item.handler({
      fromShareId: "s1",
      itemId: "i1",
      toVaultName: "Sandbox",
      confirm: true,
    });
    await tools.update_item.handler({
      shareId: "s1",
      itemId: "i1",
      fields: ["password=updated"],
      confirm: true,
    });
    await tools.trash_item.handler({
      shareId: "s1",
      itemId: "i1",
      confirm: true,
    });
    await tools.untrash_item.handler({
      shareId: "s1",
      itemId: "i1",
      confirm: true,
    });
    await tools.delete_item.handler({
      shareId: "s1",
      itemId: "i1",
      confirm: true,
    });
    await tools.download_item_attachment.handler({
      shareId: "s1",
      itemId: "i1",
      attachmentId: "a1",
      outputPath: "./tmp.bin",
      confirm: true,
    });
    await tools.share_item.handler({
      shareId: "s1",
      itemId: "i1",
      email: "user@example.com",
      role: "editor",
      confirm: true,
    });
    await tools.list_item_members.handler({
      shareId: "s1",
      itemId: "i1",
      output: "json",
    });
    await tools.update_item_member.handler({
      shareId: "s1",
      memberShareId: "m1",
      role: "editor",
      confirm: true,
    });
    await tools.remove_item_member.handler({
      shareId: "s1",
      memberShareId: "m1",
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
    expect(tools.generate_totp).toBeDefined();
    expect(tools.support).toBeDefined();
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
    expect(tools.move_item).toBeDefined();
    expect(tools.update_item).toBeDefined();
    expect(tools.trash_item).toBeDefined();
    expect(tools.untrash_item).toBeDefined();
    expect(tools.delete_item).toBeDefined();
    expect(tools.download_item_attachment).toBeDefined();
    expect(tools.share_item).toBeDefined();
    expect(tools.list_item_members).toBeDefined();
    expect(tools.update_item_member).toBeDefined();
    expect(tools.remove_item_member).toBeDefined();
    expect(tools.create_item_alias).toBeDefined();

    expect(runner).toHaveBeenCalledTimes(49);
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

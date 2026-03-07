import { afterEach, describe, expect, it } from "vitest";

import {
  checkPassCliVersion,
  checkPassConnectivity,
  checkStatusHandler,
  listInvitesHandler,
  listSharesHandler,
  listVaultMembersHandler,
  listVaultsHandler,
  parseSemver,
  PassCliAuthError,
  supportHandler,
  viewSessionInfoHandler,
  viewSettingsHandler,
  viewUserInfoHandler,
} from "../../src/server.js";

import { makeRunner, restoreProcessEnvAndMocks } from "./test-support.js";

afterEach(restoreProcessEnvAndMocks);

describe("read-only handlers", () => {
  it("viewSessionInfoHandler trims output", async () => {
    const runner = makeRunner({ stdout: " hello\n", stderr: "" });
    const result = await viewSessionInfoHandler(runner);

    expect(runner).toHaveBeenCalledWith(["info"]);
    expect(result).toEqual({ content: [{ type: "text", text: "hello" }] });
  });

  it("supportHandler returns support output", async () => {
    const runner = makeRunner({ stdout: "Reach to us if you need help\n", stderr: "" });
    const result = await supportHandler(runner);

    expect(runner).toHaveBeenCalledWith(["support"]);
    expect(result).toEqual({ content: [{ type: "text", text: "Reach to us if you need help" }] });
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
});

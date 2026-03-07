import { afterEach, describe, expect, it } from "vitest";

import {
  createItemAliasHandler,
  deleteItemHandler,
  downloadItemAttachmentHandler,
  injectHandler,
  inviteAcceptHandler,
  inviteRejectHandler,
  listItemMembersHandler,
  moveItemHandler,
  removeItemMemberHandler,
  runHandler,
  settingsSetDefaultVaultHandler,
  settingsUnsetDefaultVaultHandler,
  shareItemHandler,
  trashItemHandler,
  untrashItemHandler,
  updateItemHandler,
  updateItemMemberHandler,
} from "../../src/server.js";

import { makeRunner, restoreProcessEnvAndMocks } from "./test-support.js";

afterEach(restoreProcessEnvAndMocks);

describe("write handlers", () => {
  it("move/trash/untrash handlers validate selectors and build command arguments", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "ok", stderr: "" });

    await expect(
      moveItemHandler(runner, {
        fromShareId: "from-share",
        fromVaultName: "From Vault",
        toShareId: "to-share",
        itemId: "item-1",
        confirm: true,
      }),
    ).rejects.toThrow("Provide exactly one of fromShareId or fromVaultName");

    await moveItemHandler(runner, {
      fromShareId: "from-share",
      toVaultName: "To Vault",
      itemTitle: "GitHub",
      confirm: true,
    });

    await trashItemHandler(runner, {
      shareId: "s1",
      itemId: "i1",
      confirm: true,
    });

    await untrashItemHandler(runner, {
      vaultName: "Work",
      itemTitle: "GitHub",
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "item",
      "move",
      "--from-share-id",
      "from-share",
      "--item-title",
      "GitHub",
      "--to-vault-name",
      "To Vault",
    ]);

    expect(runner).toHaveBeenNthCalledWith(2, [
      "item",
      "trash",
      "--share-id",
      "s1",
      "--item-id",
      "i1",
    ]);

    expect(runner).toHaveBeenNthCalledWith(3, [
      "item",
      "untrash",
      "--vault-name",
      "Work",
      "--item-title",
      "GitHub",
    ]);
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

  it("attachment and item-member handlers build expected command arguments", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner(async (args) => {
      if (args[0] === "item" && args[1] === "member" && args[2] === "list") {
        return { stdout: '{"members":[]}', stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    await downloadItemAttachmentHandler(runner, {
      shareId: "s1",
      itemId: "i1",
      attachmentId: "a1",
      outputPath: "./tmp.bin",
      confirm: true,
    });

    const listResult = await listItemMembersHandler(runner, {
      shareId: "s1",
      itemId: "i1",
      output: "json",
    });

    await updateItemMemberHandler(runner, {
      shareId: "s1",
      memberShareId: "m1",
      role: "editor",
      confirm: true,
    });

    await removeItemMemberHandler(runner, {
      shareId: "s1",
      memberShareId: "m1",
      confirm: true,
    });

    expect(runner).toHaveBeenNthCalledWith(1, [
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
      "./tmp.bin",
    ]);

    expect(runner).toHaveBeenNthCalledWith(2, [
      "item",
      "member",
      "list",
      "--share-id",
      "s1",
      "--item-id",
      "i1",
      "--output",
      "json",
    ]);

    expect(runner).toHaveBeenNthCalledWith(3, [
      "item",
      "member",
      "update",
      "--share-id",
      "s1",
      "--member-share-id",
      "m1",
      "--role",
      "editor",
    ]);

    expect(runner).toHaveBeenNthCalledWith(4, [
      "item",
      "member",
      "remove",
      "--share-id",
      "s1",
      "--member-share-id",
      "m1",
    ]);
    expect(listResult.content[0].text).toContain('"members"');
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

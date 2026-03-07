import { afterEach, describe, expect, it } from "vitest";

import {
  createVaultHandler,
  deleteVaultHandler,
  removeVaultMemberHandler,
  shareVaultHandler,
  transferVaultHandler,
  updateVaultHandler,
  updateVaultMemberHandler,
} from "../../src/server.js";

import { makeRunner, restoreProcessEnvAndMocks } from "./test-support.js";

afterEach(restoreProcessEnvAndMocks);

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
});

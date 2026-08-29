import { afterEach, describe, expect, it } from "vitest";

import {
  createCreditCardItemHandler,
  createCustomItemHandler,
  createIdentityItemHandler,
  createLoginItemFromTemplateHandler,
  createLoginItemHandler,
  createNoteItemHandler,
  createWifiItemHandler,
} from "../../src/server.js";

import { makeRunner, restoreProcessEnvAndMocks } from "./test-support.js";
import {
  createCreditCardItemInputSchema,
  createWifiItemInputSchema,
  customItemTemplateSchema,
  loginItemTemplateSchema,
} from "../../src/tools/item/schemas-create.js";

afterEach(restoreProcessEnvAndMocks);

describe("write handlers", () => {
  it("createLoginItemHandler handles selector conflicts and generate-password modes", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: '{"id":"1"}', stderr: "" });

    await expect(
      createLoginItemHandler(runner, {
        shareId: "s1",
        vaultName: "Work",
        title: "GitHub",
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await createLoginItemHandler(runner, {
      shareId: "s1",
      title: "GitHub",
      generatePassword: "true",
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
        confirm: true,
      }),
    ).rejects.toThrow("Provide only one of shareId or vaultName");

    await createLoginItemFromTemplateHandler(runner, {
      shareId: "s1",
      template: { title: "Demo", urls: ["https://example.com"] },
      confirm: true,
    });

    expect(runner).toHaveBeenCalledWith(
      ["item", "create", "login", "--from-template", "-", "--share-id", "s1"],
      '{"title":"Demo","urls":["https://example.com"]}',
    );

    await createLoginItemFromTemplateHandler(runner, {
      vaultName: "Work",
      template: { title: "Demo", urls: ["https://example.com"] },
      confirm: true,
    });

    expect(runner).toHaveBeenLastCalledWith(
      ["item", "create", "login", "--from-template", "-", "--vault-name", "Work"],
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

    expect(runner).toHaveBeenNthCalledWith(
      3,
      ["item", "create", "wifi", "--from-template", "-", "--share-id", "s1"],
      JSON.stringify({
        title: "Cafe WiFi",
        ssid: "Cafe",
        password: "",
        security: "open",
        note: "Guest",
      }),
    );
  });

  it.each([
    [{ vaultName: "Work" }, ["--vault-name", "Work"]],
    [{}, []],
  ])("createWifiItemHandler uses template stdin for scope %j", async (scope, scopeArgs) => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "created", stderr: "" });
    await createWifiItemHandler(runner, {
      ...scope,
      title: "Guest",
      ssid: "Guest",
      security: "unspecified",
      confirm: true,
    });
    expect(runner).toHaveBeenCalledWith(
      ["item", "create", "wifi", "--from-template", "-", ...scopeArgs],
      '{"title":"Guest","ssid":"Guest","security":"unspecified"}',
    );
  });

  it("login templates accept and forward the current CLI TOTP field", async () => {
    process.env.ALLOW_WRITE = "1";
    const runner = makeRunner({ stdout: "created", stderr: "" });
    const template = loginItemTemplateSchema.parse({
      title: "TOTP login",
      totp_uri: "otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP",
    });
    await createLoginItemFromTemplateHandler(runner, { template, confirm: true });
    expect(runner).toHaveBeenCalledWith(
      ["item", "create", "login", "--from-template", "-"],
      JSON.stringify(template),
    );
    expect(loginItemTemplateSchema.parse({ title: "No TOTP", totp_uri: null }).totp_uri).toBeNull();
  });

  it("validates card expiration, nonblank WiFi SSID, and signed 64-bit custom timestamps", () => {
    for (const expirationDate of ["", "2000-01", "9999-12"]) {
      expect(
        createCreditCardItemInputSchema.safeParse({ title: "Card", expirationDate }).success,
      ).toBe(true);
    }
    for (const expirationDate of ["1999-12", "2027-00", "2027-13", "2027-1"]) {
      expect(
        createCreditCardItemInputSchema.safeParse({ title: "Card", expirationDate }).success,
      ).toBe(false);
    }
    expect(createWifiItemInputSchema.safeParse({ title: "Guest", ssid: " \t\n" }).success).toBe(
      false,
    );
    const custom = (value: string, field_type = "timestamp") => ({
      title: "Custom",
      sections: [{ section_name: "Dates", fields: [{ field_name: "Date", field_type, value }] }],
    });
    for (const value of ["-9223372036854775808", "+0", "9223372036854775807"]) {
      expect(customItemTemplateSchema.safeParse(custom(value)).success).toBe(true);
    }
    for (const value of [
      "-9223372036854775809",
      "9223372036854775808",
      "1.5",
      " 1",
      "not a date",
    ]) {
      expect(customItemTemplateSchema.safeParse(custom(value)).success).toBe(false);
    }
    expect(customItemTemplateSchema.safeParse(custom("plain text", "unknown")).success).toBe(false);
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
});

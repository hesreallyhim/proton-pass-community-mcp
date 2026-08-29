import { afterEach, describe, expect, it } from "vitest";

import {
  generatePassphraseHandler,
  generatePassphraseInputSchema,
  generateRandomPasswordHandler,
  generateTotpHandler,
  itemTotpHandler,
  scorePasswordHandler,
  viewItemHandler,
} from "../../src/server.js";

import { makeRunner, restoreProcessEnvAndMocks } from "./test-support.js";

afterEach(restoreProcessEnvAndMocks);

describe("read-only handlers", () => {
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

  it.each([
    { label: "numeric text", stdout: "1e3\n", expected: "1e3" },
    { label: "JSON-looking text", stdout: '{ "key" : true }\n', expected: '{ "key" : true }' },
    { label: "significant whitespace", stdout: " \tvalue \r\n", expected: " \tvalue \r" },
    { label: "a trailing newline in the value", stdout: "value\n\n", expected: "value\n" },
    { label: "no CLI newline", stdout: " value\r", expected: " value\r" },
    { label: "an empty value", stdout: "\n", expected: "" },
  ])("viewItemHandler preserves raw field output: $label", async ({ stdout, expected }) => {
    const runner = makeRunner({ stdout, stderr: "" });
    const selected = await viewItemHandler(runner, {
      shareId: "share-1",
      itemId: "item-1",
      field: "password",
      output: "json",
    });
    const referenced = await viewItemHandler(runner, {
      uri: "pass://share-1/item-1/password",
      output: "json",
    });

    expect(selected.content[0].text).toBe(expected);
    expect(referenced.content[0].text).toBe(expected);
  });

  it("viewItemHandler still formats whole-item JSON output", async () => {
    const runner = makeRunner({ stdout: '{ "name" : "Example" }\n', stderr: "" });

    const result = await viewItemHandler(runner, {
      uri: "pass://share-1/item-1",
      output: "json",
    });

    expect(result.content[0].text).toBe('{\n  "name": "Example"\n}');
  });

  it.each([
    { name: "viewItemHandler", handler: viewItemHandler },
    { name: "itemTotpHandler", handler: itemTotpHandler },
  ])("$name rejects combining a URI with an explicit field", async ({ handler }) => {
    const runner = makeRunner();

    await expect(
      handler(runner, {
        uri: "pass://share-1/item-1",
        field: "totp",
        output: "json",
      }),
    ).rejects.toThrow("Encode the field in uri");
    expect(runner).not.toHaveBeenCalled();
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
      "--output",
      "json",
      "--",
      "MySecureP@ssw0rd",
    ]);

    expect(randomResult).toEqual({ content: [{ type: "text", text: "generated-value" }] });
    expect(passphraseResult).toEqual({ content: [{ type: "text", text: "generated-value" }] });
    expect(scoreResult).toEqual({
      content: [{ type: "text", text: '{\n  "password_score": "Strong"\n}' }],
    });
  });

  it("passphrase separators use CLI enum names instead of literal separators", async () => {
    const runner = makeRunner({ stdout: "generated-value\n", stderr: "" });
    const input = generatePassphraseInputSchema.parse({ separator: "numbers-and-symbols" });

    await generatePassphraseHandler(runner, input);

    expect(runner).toHaveBeenCalledWith([
      "password",
      "generate",
      "passphrase",
      "--separator",
      "numbers-and-symbols",
    ]);
    expect(generatePassphraseInputSchema.safeParse({ separator: "-" }).success).toBe(false);
    expect(generatePassphraseInputSchema.safeParse({ separator: "custom" }).success).toBe(false);
  });

  it("scorePasswordHandler puts leading-dash passwords after the terminator", async () => {
    const runner = makeRunner({ stdout: "{}", stderr: "" });

    await scorePasswordHandler(runner, { password: "--output", output: "json" });

    expect(runner).toHaveBeenCalledWith([
      "password",
      "score",
      "--output",
      "json",
      "--",
      "--output",
    ]);
  });

  it.each(["otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP", "--output"])(
    "generateTotpHandler forwards input after the terminator: %s",
    async (secretOrUri) => {
      const runner = makeRunner({ stdout: '{"totp":"123456"}', stderr: "" });
      const result = await generateTotpHandler(runner, {
        secretOrUri,
        output: "json",
      });

      expect(runner).toHaveBeenCalledWith([
        "totp",
        "generate",
        "--output",
        "json",
        "--",
        secretOrUri,
      ]);
      expect(result.content[0].text).toContain('"totp": "123456"');
    },
  );
});

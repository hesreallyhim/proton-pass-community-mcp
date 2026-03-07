import { afterEach, describe, expect, it } from "vitest";

import {
  generatePassphraseHandler,
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

  it("generateTotpHandler forwards secret and output format", async () => {
    const runner = makeRunner({ stdout: '{"totp":"123456"}', stderr: "" });
    const result = await generateTotpHandler(runner, {
      secretOrUri: "otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP",
      output: "json",
    });

    expect(runner).toHaveBeenCalledWith([
      "totp",
      "generate",
      "otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP",
      "--output",
      "json",
    ]);
    expect(result.content[0].text).toContain('"totp": "123456"');
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { createCoreToolDefinitions } from "../../src/server/tool-definitions-core.js";
import { createItemToolDefinitions } from "../../src/server/tool-definitions-item.js";
import { makeRunner, restoreProcessEnvAndMocks } from "./test-support.js";

afterEach(restoreProcessEnvAndMocks);

const reason = "Retrieve the deployment credential for the requested staging deployment";
const cases = [
  ["view_item", { uri: "pass://s/i/password" }],
  ["generate_item_totp", { uri: "pass://s/i/totp" }],
  ["create_login_item", { title: "Test", shareId: "s" }],
  ["create_login_item_from_template", { template: { title: "Test" }, shareId: "s" }],
  ["create_note_item", { title: "Test", shareId: "s" }],
  ["create_credit_card_item", { title: "Test", shareId: "s" }],
  ["create_wifi_item", { title: "Test", ssid: "Test network", vaultName: "Work" }],
  ["create_custom_item", { template: { title: "Test" }, shareId: "s" }],
  ["create_identity_item", { template: { title: "Test" }, shareId: "s" }],
  ["move_item", { fromShareId: "s", toShareId: "t", itemId: "i" }],
  ["update_item", { shareId: "s", itemId: "i", fields: ["title=Test"] }],
  ["trash_item", { shareId: "s", itemId: "i" }],
  ["untrash_item", { shareId: "s", itemId: "i" }],
  ["delete_item", { shareId: "s", itemId: "i" }],
  ["update_vault", { shareId: "s", newName: "Test" }],
  ["inject", { inFile: "fixture.txt" }],
  ["run", { command: ["fixture-command"] }],
] as const;

function getTool(name: string, runner: ReturnType<typeof makeRunner>) {
  const tool = [...createCoreToolDefinitions(runner), ...createItemToolDefinitions(runner)].find(
    (candidate) => candidate.name === name,
  );
  if (!tool || tool.kind !== "input") throw new Error(`Missing input tool ${name}`);
  return tool;
}

describe("per-operation agent reasons", () => {
  it.each(cases)(
    "%s forwards a validated reason separately from arguments and stdin",
    async (name, input) => {
      process.env.ALLOW_WRITE = "1";
      const runner = makeRunner({ stdout: "fixture output\n", stderr: "" });
      const tool = getTool(name, runner);
      await tool.handler(tool.inputSchema.parse({ ...input, confirm: true, agentReason: reason }));
      expect(runner).toHaveBeenCalledTimes(1);
      const [args, stdin, options] = runner.mock.calls[0];
      expect(options).toEqual({ agentReason: reason });
      expect(JSON.stringify(args)).not.toContain(reason);
      expect(stdin ?? "").not.toContain(reason);
    },
  );

  it.each(["update_item", "trash_item", "untrash_item", "update_vault"])(
    "%s refuses missing/invalid reasons before invoking a mutation, including direct handlers",
    async (name) => {
      process.env.ALLOW_WRITE = "1";
      const runner = makeRunner();
      const tool = getTool(name, runner);
      const input = cases.find(([candidate]) => candidate === name)![1];
      for (const agentReason of [undefined, " \n\t", "😀".repeat(301)]) {
        const args = { ...input, confirm: true, agentReason };
        expect(tool.inputSchema.safeParse(args).success).toBe(false);
        await expect(tool.handler(args)).rejects.toThrow();
      }
      expect(runner).not.toHaveBeenCalled();
    },
  );

  it("accepts 300 Unicode code points and preserves surrounding whitespace", async () => {
    const runner = makeRunner();
    const tool = getTool("view_item", runner);
    const agentReason = ` ${"😀".repeat(298)} `;
    await tool.handler(tool.inputSchema.parse({ uri: "pass://s/i/password", agentReason }));
    expect(runner.mock.calls[0][2]).toEqual({ agentReason });
  });

  it("keeps ordinary read calls without a reason compatible", async () => {
    const runner = makeRunner();
    const tool = getTool("view_item", runner);
    await tool.handler(tool.inputSchema.parse({ uri: "pass://s/i" }));
    expect(runner).toHaveBeenCalledWith(["item", "view", "--output", "json", "--", "pass://s/i"]);
  });
});

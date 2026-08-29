import assert from "node:assert/strict";
import { appendFile, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import process from "node:process";
import { URL } from "node:url";

// This is an explicit public-surface contract, not a list derived from the server under test.
export const EXPECTED_TOOL_NAMES = Object.freeze(
  [
    "accept_invite",
    "check_status",
    "create_credit_card_item",
    "create_custom_item",
    "create_identity_item",
    "create_item_alias",
    "create_login_item",
    "create_login_item_from_template",
    "create_note_item",
    "create_vault",
    "create_wifi_item",
    "delete_item",
    "delete_vault",
    "download_item_attachment",
    "generate_item_totp",
    "generate_passphrase",
    "generate_random_password",
    "generate_totp",
    "inject",
    "list_invites",
    "list_item_members",
    "list_items",
    "list_shares",
    "list_vault_members",
    "list_vaults",
    "move_item",
    "reject_invite",
    "remove_item_member",
    "remove_vault_member",
    "run",
    "score_password",
    "search_items",
    "set_default_vault",
    "share_item",
    "share_vault",
    "transfer_vault",
    "trash_item",
    "unset_default_vault",
    "untrash_item",
    "update_item",
    "update_item_member",
    "update_vault",
    "update_vault_member",
    "view_item",
    "view_session_info",
    "view_settings",
    "view_user_info",
  ].sort(),
);

export const ITEM_TEMPLATE_TYPES = Object.freeze([
  "credit-card",
  "custom",
  "identity",
  "login",
  "note",
  "wifi",
]);

// Intentionally valid JSON with spelling and whitespace that must remain untouched.
export const SMOKE_RAW_FIELD_VALUE = ' \t{ "fixture" : true, "number" : 1e3 } \r\n';

export const SMOKE_VIEW_URI_ARGS = Object.freeze([
  "item",
  "view",
  "--output",
  "json",
  "--",
  "pass://smoke-share/smoke-item/password",
]);

export const SMOKE_VIEW_SELECTOR_ARGS = Object.freeze([
  "item",
  "view",
  "--share-id",
  "smoke-share",
  "--item-id",
  "smoke-item",
  "--field",
  "password",
  "--output",
  "json",
]);

export async function createMcpSmokeFixture(directory) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "package.json"), '{"private":true,"type":"module"}\n');
  await copyFile(new URL(import.meta.url), join(directory, "mcp-smoke-fixture.mjs"));

  // PASS_CLI_BIN is the absolute Node executable. Normal CLI argv selects these
  // local Node programs, so no shell, executable shim, or real pass-cli is involved.
  const entrypoint =
    'import { runFakePassCli } from "./mcp-smoke-fixture.mjs";\nawait runFakePassCli();\n';
  for (const command of ["info", "item", "vault"]) {
    await writeFile(join(directory, command), entrypoint);
  }
  const logPath = join(directory, "cli-calls.jsonl");
  const contextLogPath = join(directory, "cli-contexts.jsonl");
  await writeFile(logPath, "");
  await writeFile(contextLogPath, "");
  return {
    cwd: directory,
    logPath,
    contextLogPath,
    env: {
      PASS_CLI_BIN: process.execPath,
      ALLOW_WRITE: "0",
      MCP_SMOKE_CLI_LOG: logPath,
      MCP_SMOKE_CONTEXT_LOG: contextLogPath,
    },
  };
}

export async function readMcpSmokeCliCalls(logPath) {
  const text = (await readFile(logPath, "utf8")).trim();
  return text ? text.split("\n").map((line) => JSON.parse(line)) : [];
}

export async function readMcpSmokeInvocationContexts(logPath) {
  return readMcpSmokeCliCalls(logPath);
}

export async function runFakePassCli() {
  const logPath = process.env.MCP_SMOKE_CLI_LOG;
  const contextLogPath = process.env.MCP_SMOKE_CONTEXT_LOG;
  assert.ok(logPath, "The smoke fixture requires an explicit call log path.");
  assert.ok(contextLogPath, "The smoke fixture requires an explicit context log path.");
  const args = [basename(process.argv[1]), ...process.argv.slice(2)];
  await appendFile(logPath, `${JSON.stringify(args)}\n`);
  await appendFile(
    contextLogPath,
    `${JSON.stringify({ args, agentReason: process.env.PROTON_PASS_AGENT_REASON ?? null })}\n`,
  );

  const responses = new Map([
    [JSON.stringify(["info", "--output", "json"]), JSON.stringify({ status: "mock-pass-info" })],
    [
      JSON.stringify(["item", "list", "--share-id", "smoke-share", "--output", "json"]),
      JSON.stringify([
        {
          id: "smoke-item",
          share_id: "smoke-share",
          vault_id: "smoke-vault",
          title: "Smoke login",
          item_type: "login",
          state: "active",
          create_time: "2026-01-01T00:00:00Z",
          modify_time: "2026-01-02T00:00:00Z",
        },
      ]),
    ],
    [JSON.stringify(SMOKE_VIEW_URI_ARGS), SMOKE_RAW_FIELD_VALUE],
    [JSON.stringify(SMOKE_VIEW_SELECTOR_ARGS), SMOKE_RAW_FIELD_VALUE],
  ]);
  const response = responses.get(JSON.stringify(args));
  assert.notEqual(
    response,
    undefined,
    `Unexpected smoke fixture invocation: ${JSON.stringify(args)}`,
  );
  process.stdout.write(`${response}\n`);
}

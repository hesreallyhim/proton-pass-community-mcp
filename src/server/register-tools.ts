import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { withAuthErrorHandling } from "../pass-cli/errors.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import type { PassCliVersionPolicy } from "../pass-cli/version.js";
import { checkStatusHandler } from "../tools/check-status.js";
import { injectHandler, injectInputSchema, runHandler, runInputSchema } from "../tools/contents.js";
import {
  createCreditCardItemHandler,
  createCreditCardItemInputSchema,
  createCustomItemHandler,
  createCustomItemInputSchema,
  createIdentityItemHandler,
  createIdentityItemInputSchema,
  createItemAliasHandler,
  createItemAliasInputSchema,
  createLoginItemFromTemplateHandler,
  createLoginItemFromTemplateInputSchema,
  createLoginItemHandler,
  createLoginItemInputSchema,
  createNoteItemHandler,
  createNoteItemInputSchema,
  createWifiItemHandler,
  createWifiItemInputSchema,
  deleteItemHandler,
  deleteItemInputSchema,
  downloadItemAttachmentHandler,
  downloadItemAttachmentInputSchema,
  itemTotpHandler,
  itemTotpInputSchema,
  listItemMembersHandler,
  listItemMembersInputSchema,
  listItemsHandler,
  listItemsInputSchema,
  moveItemHandler,
  moveItemInputSchema,
  removeItemMemberHandler,
  removeItemMemberInputSchema,
  searchItemsHandler,
  searchItemsInputSchema,
  shareItemHandler,
  shareItemInputSchema,
  trashItemHandler,
  trashItemInputSchema,
  untrashItemHandler,
  untrashItemInputSchema,
  updateItemHandler,
  updateItemInputSchema,
  updateItemMemberHandler,
  updateItemMemberInputSchema,
  viewItemHandler,
  viewItemInputSchema,
} from "../tools/item.js";
import {
  inviteAcceptHandler,
  inviteAcceptInputSchema,
  inviteRejectHandler,
  inviteRejectInputSchema,
  listInvitesHandler,
  listInvitesInputSchema,
} from "../tools/invite.js";
import {
  generatePassphraseHandler,
  generatePassphraseInputSchema,
  generateRandomPasswordHandler,
  generateRandomPasswordInputSchema,
  scorePasswordHandler,
  scorePasswordInputSchema,
} from "../tools/password.js";
import {
  viewSessionInfoHandler,
  viewUserInfoHandler,
  viewUserInfoInputSchema,
} from "../tools/session.js";
import {
  settingsSetDefaultVaultHandler,
  settingsSetDefaultVaultInputSchema,
  settingsUnsetDefaultVaultHandler,
  settingsUnsetDefaultVaultInputSchema,
  viewSettingsHandler,
} from "../tools/settings.js";
import { listSharesHandler, listSharesInputSchema } from "../tools/share.js";
import { supportHandler } from "../tools/support.js";
import { generateTotpHandler, generateTotpInputSchema } from "../tools/totp.js";
import {
  createVaultHandler,
  createVaultInputSchema,
  deleteVaultHandler,
  deleteVaultInputSchema,
  listVaultMembersHandler,
  listVaultMembersInputSchema,
  listVaultsHandler,
  listVaultsInputSchema,
  removeVaultMemberHandler,
  removeVaultMemberInputSchema,
  shareVaultHandler,
  shareVaultInputSchema,
  transferVaultHandler,
  transferVaultInputSchema,
  updateVaultHandler,
  updateVaultInputSchema,
  updateVaultMemberHandler,
  updateVaultMemberInputSchema,
} from "../tools/vault.js";

type NoInputTool = {
  kind: "no-input";
  name: string;
  description: string;
  handler: () => Promise<any>;
  auth?: boolean;
};

type InputTool = {
  kind: "input";
  name: string;
  description: string;
  inputSchema: any;
  handler: (input: any) => Promise<any>;
  auth?: boolean;
};

type ToolDefinition = NoInputTool | InputTool;

function noInputTool(
  name: string,
  description: string,
  handler: () => Promise<any>,
  auth = true,
): NoInputTool {
  return { kind: "no-input", name, description, handler, auth };
}

function inputTool(
  name: string,
  description: string,
  inputSchema: any,
  handler: (input: any) => Promise<any>,
  auth = true,
): InputTool {
  return { kind: "input", name, description, inputSchema, handler, auth };
}

function registerToolDefinition(server: McpServer, tool: ToolDefinition): void {
  if (tool.kind === "input") {
    const handler = tool.auth === false ? tool.handler : withAuthErrorHandling(tool.handler);
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema as any },
      handler as any,
    );
    return;
  }

  const handler = tool.auth === false ? tool.handler : withAuthErrorHandling(tool.handler);
  server.registerTool(tool.name, { description: tool.description }, handler as any);
}

export function registerTools(
  server: McpServer,
  passCli: PassCliRunner,
  versionPolicy: PassCliVersionPolicy = {},
) {
  const tools: ToolDefinition[] = [
    noInputTool(
      "view_session_info",
      "View current Proton Pass session/account summary from pass-cli info.",
      () => viewSessionInfoHandler(passCli),
    ),
    noInputTool(
      "check_status",
      "Run preflight checks for connectivity/authentication and CLI version compatibility.",
      () => checkStatusHandler(passCli, versionPolicy),
      false,
    ),
    noInputTool("support", "Display Proton Pass CLI support guidance text.", () =>
      supportHandler(passCli),
    ),
    inputTool(
      "inject",
      "Inject secrets from Proton Pass references into a template file.",
      injectInputSchema,
      (input) => injectHandler(passCli, input),
    ),
    inputTool(
      "run",
      "Run a command with Proton Pass secret references resolved in environment.",
      runInputSchema,
      (input) => runHandler(passCli, input),
    ),
    inputTool(
      "view_user_info",
      "View Proton user profile/account details from pass-cli user info.",
      viewUserInfoInputSchema,
      (input) => viewUserInfoHandler(passCli, input),
    ),
    inputTool(
      "list_vaults",
      "List vaults accessible to the current authenticated user.",
      listVaultsInputSchema,
      (input) => listVaultsHandler(passCli, input),
    ),
    inputTool("create_vault", "Create a new vault.", createVaultInputSchema, (input) =>
      createVaultHandler(passCli, input),
    ),
    inputTool(
      "update_vault",
      "Update a vault by share ID or vault name.",
      updateVaultInputSchema,
      (input) => updateVaultHandler(passCli, input),
    ),
    inputTool("share_vault", "Share a vault with a user.", shareVaultInputSchema, (input) =>
      shareVaultHandler(passCli, input),
    ),
    inputTool(
      "transfer_vault",
      "Transfer vault ownership to a member.",
      transferVaultInputSchema,
      (input) => transferVaultHandler(passCli, input),
    ),
    inputTool(
      "delete_vault",
      "Delete a vault by share ID or vault name.",
      deleteVaultInputSchema,
      (input) => deleteVaultHandler(passCli, input),
    ),
    inputTool(
      "list_shares",
      "List shares accessible to the current authenticated user.",
      listSharesInputSchema,
      (input) => listSharesHandler(passCli, input),
    ),
    inputTool(
      "list_invites",
      "List pending invitations accessible to the current authenticated user.",
      listInvitesInputSchema,
      (input) => listInvitesHandler(passCli, input),
    ),
    inputTool("accept_invite", "Accept an invitation token.", inviteAcceptInputSchema, (input) =>
      inviteAcceptHandler(passCli, input),
    ),
    inputTool("reject_invite", "Reject an invitation token.", inviteRejectInputSchema, (input) =>
      inviteRejectHandler(passCli, input),
    ),
    noInputTool("view_settings", "View current Proton Pass CLI settings.", () =>
      viewSettingsHandler(passCli),
    ),
    inputTool(
      "set_default_vault",
      "Set default vault by share ID or vault name.",
      settingsSetDefaultVaultInputSchema,
      (input) => settingsSetDefaultVaultHandler(passCli, input),
    ),
    inputTool(
      "unset_default_vault",
      "Unset default vault setting.",
      settingsUnsetDefaultVaultInputSchema,
      (input) => settingsUnsetDefaultVaultHandler(passCli, input),
    ),
    inputTool(
      "generate_random_password",
      "Generate a random password.",
      generateRandomPasswordInputSchema,
      (input) => generateRandomPasswordHandler(passCli, input),
    ),
    inputTool(
      "generate_passphrase",
      "Generate a passphrase.",
      generatePassphraseInputSchema,
      (input) => generatePassphraseHandler(passCli, input),
    ),
    inputTool("score_password", "Score password strength.", scorePasswordInputSchema, (input) =>
      scorePasswordHandler(passCli, input),
    ),
    inputTool(
      "generate_totp",
      "Generate a TOTP token from a secret or otpauth URI.",
      generateTotpInputSchema,
      (input) => generateTotpHandler(passCli, input),
    ),
    inputTool(
      "list_vault_members",
      "List members for a vault by share ID or vault name.",
      listVaultMembersInputSchema,
      (input) => listVaultMembersHandler(passCli, input),
    ),
    inputTool(
      "update_vault_member",
      "Update a vault member role.",
      updateVaultMemberInputSchema,
      (input) => updateVaultMemberHandler(passCli, input),
    ),
    inputTool(
      "remove_vault_member",
      "Remove a member from a vault.",
      removeVaultMemberInputSchema,
      (input) => removeVaultMemberHandler(passCli, input),
    ),
    inputTool(
      "list_items",
      "List items for a vault or share with MCP pagination support for JSON output.",
      listItemsInputSchema,
      (input) => listItemsHandler(passCli, input),
    ),
    inputTool(
      "view_item",
      "View a specific item by URI or selectors, optionally returning a specific field.",
      viewItemInputSchema,
      (input) => viewItemHandler(passCli, input),
    ),
    inputTool(
      "generate_item_totp",
      "Generate TOTP code(s) for an item by URI or selectors, optionally targeting a specific field.",
      itemTotpInputSchema,
      (input) => itemTotpHandler(passCli, input),
    ),
    inputTool(
      "create_login_item",
      "Create a login item in a vault or share.",
      createLoginItemInputSchema,
      (input) => createLoginItemHandler(passCli, input),
    ),
    inputTool(
      "create_login_item_from_template",
      "Create a login item from template JSON.",
      createLoginItemFromTemplateInputSchema,
      (input) => createLoginItemFromTemplateHandler(passCli, input),
    ),
    inputTool(
      "create_note_item",
      "Create a note item in a vault or share.",
      createNoteItemInputSchema,
      (input) => createNoteItemHandler(passCli, input),
    ),
    inputTool(
      "create_credit_card_item",
      "Create a credit card item in a vault or share.",
      createCreditCardItemInputSchema,
      (input) => createCreditCardItemHandler(passCli, input),
    ),
    inputTool(
      "create_wifi_item",
      "Create a WiFi item in a vault or share.",
      createWifiItemInputSchema,
      (input) => createWifiItemHandler(passCli, input),
    ),
    inputTool(
      "create_custom_item",
      "Create a custom item from template payload in a vault or share.",
      createCustomItemInputSchema,
      (input) => createCustomItemHandler(passCli, input),
    ),
    inputTool(
      "create_identity_item",
      "Create an identity item from template payload in a vault or share.",
      createIdentityItemInputSchema,
      (input) => createIdentityItemHandler(passCli, input),
    ),
    inputTool(
      "move_item",
      "Move an item from one vault to another.",
      moveItemInputSchema,
      (input) => moveItemHandler(passCli, input),
    ),
    inputTool(
      "update_item",
      "Update an item using selectors and field assignments.",
      updateItemInputSchema,
      (input) => updateItemHandler(passCli, input),
    ),
    inputTool("trash_item", "Move an item to trash by selectors.", trashItemInputSchema, (input) =>
      trashItemHandler(passCli, input),
    ),
    inputTool(
      "untrash_item",
      "Restore an item from trash by selectors.",
      untrashItemInputSchema,
      (input) => untrashItemHandler(passCli, input),
    ),
    inputTool(
      "delete_item",
      "Delete an item by share ID and item ID.",
      deleteItemInputSchema,
      (input) => deleteItemHandler(passCli, input),
    ),
    inputTool(
      "download_item_attachment",
      "Download an item attachment to a local path.",
      downloadItemAttachmentInputSchema,
      (input) => downloadItemAttachmentHandler(passCli, input),
    ),
    inputTool(
      "create_item_alias",
      "Create an email alias item.",
      createItemAliasInputSchema,
      (input) => createItemAliasHandler(passCli, input),
    ),
    inputTool("list_item_members", "List item members.", listItemMembersInputSchema, (input) =>
      listItemMembersHandler(passCli, input),
    ),
    inputTool(
      "update_item_member",
      "Update an item member role.",
      updateItemMemberInputSchema,
      (input) => updateItemMemberHandler(passCli, input),
    ),
    inputTool(
      "remove_item_member",
      "Remove an item member.",
      removeItemMemberInputSchema,
      (input) => removeItemMemberHandler(passCli, input),
    ),
    inputTool("share_item", "Share an item with a user.", shareItemInputSchema, (input) =>
      shareItemHandler(passCli, input),
    ),
    inputTool(
      "search_items",
      "Search items by title with MCP pagination support for JSON output.",
      searchItemsInputSchema,
      (input) => searchItemsHandler(passCli, input),
    ),
  ];

  for (const tool of tools) {
    registerToolDefinition(server, tool);
  }
}

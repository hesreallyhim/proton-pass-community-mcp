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

type ToolDefinition =
  | {
      kind: "no-input";
      name: string;
      description: string;
      handler: () => Promise<any>;
      auth?: boolean;
    }
  | {
      kind: "input";
      name: string;
      description: string;
      inputSchema: any;
      handler: (input: any) => Promise<any>;
      auth?: boolean;
    };

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
    {
      kind: "no-input",
      name: "view_session_info",
      description: "View current Proton Pass session/account summary from pass-cli info.",
      handler: () => viewSessionInfoHandler(passCli),
    },
    {
      kind: "no-input",
      name: "check_status",
      description:
        "Run preflight checks for connectivity/authentication and CLI version compatibility.",
      handler: () => checkStatusHandler(passCli, versionPolicy),
      auth: false,
    },
    {
      kind: "no-input",
      name: "support",
      description: "Display Proton Pass CLI support guidance text.",
      handler: () => supportHandler(passCli),
    },
    {
      kind: "input",
      name: "inject",
      description: "Inject secrets from Proton Pass references into a template file.",
      inputSchema: injectInputSchema,
      handler: (input) => injectHandler(passCli, input),
    },
    {
      kind: "input",
      name: "run",
      description: "Run a command with Proton Pass secret references resolved in environment.",
      inputSchema: runInputSchema,
      handler: (input) => runHandler(passCli, input),
    },
    {
      kind: "input",
      name: "view_user_info",
      description: "View Proton user profile/account details from pass-cli user info.",
      inputSchema: viewUserInfoInputSchema,
      handler: (input) => viewUserInfoHandler(passCli, input),
    },
    {
      kind: "input",
      name: "list_vaults",
      description: "List vaults accessible to the current authenticated user.",
      inputSchema: listVaultsInputSchema,
      handler: (input) => listVaultsHandler(passCli, input),
    },
    {
      kind: "input",
      name: "create_vault",
      description: "Create a new vault.",
      inputSchema: createVaultInputSchema,
      handler: (input) => createVaultHandler(passCli, input),
    },
    {
      kind: "input",
      name: "update_vault",
      description: "Update a vault by share ID or vault name.",
      inputSchema: updateVaultInputSchema,
      handler: (input) => updateVaultHandler(passCli, input),
    },
    {
      kind: "input",
      name: "share_vault",
      description: "Share a vault with a user.",
      inputSchema: shareVaultInputSchema,
      handler: (input) => shareVaultHandler(passCli, input),
    },
    {
      kind: "input",
      name: "transfer_vault",
      description: "Transfer vault ownership to a member.",
      inputSchema: transferVaultInputSchema,
      handler: (input) => transferVaultHandler(passCli, input),
    },
    {
      kind: "input",
      name: "delete_vault",
      description: "Delete a vault by share ID or vault name.",
      inputSchema: deleteVaultInputSchema,
      handler: (input) => deleteVaultHandler(passCli, input),
    },
    {
      kind: "input",
      name: "list_shares",
      description: "List shares accessible to the current authenticated user.",
      inputSchema: listSharesInputSchema,
      handler: (input) => listSharesHandler(passCli, input),
    },
    {
      kind: "input",
      name: "list_invites",
      description: "List pending invitations accessible to the current authenticated user.",
      inputSchema: listInvitesInputSchema,
      handler: (input) => listInvitesHandler(passCli, input),
    },
    {
      kind: "input",
      name: "accept_invite",
      description: "Accept an invitation token.",
      inputSchema: inviteAcceptInputSchema,
      handler: (input) => inviteAcceptHandler(passCli, input),
    },
    {
      kind: "input",
      name: "reject_invite",
      description: "Reject an invitation token.",
      inputSchema: inviteRejectInputSchema,
      handler: (input) => inviteRejectHandler(passCli, input),
    },
    {
      kind: "no-input",
      name: "view_settings",
      description: "View current Proton Pass CLI settings.",
      handler: () => viewSettingsHandler(passCli),
    },
    {
      kind: "input",
      name: "set_default_vault",
      description: "Set default vault by share ID or vault name.",
      inputSchema: settingsSetDefaultVaultInputSchema,
      handler: (input) => settingsSetDefaultVaultHandler(passCli, input),
    },
    {
      kind: "input",
      name: "unset_default_vault",
      description: "Unset default vault setting.",
      inputSchema: settingsUnsetDefaultVaultInputSchema,
      handler: (input) => settingsUnsetDefaultVaultHandler(passCli, input),
    },
    {
      kind: "input",
      name: "generate_random_password",
      description: "Generate a random password.",
      inputSchema: generateRandomPasswordInputSchema,
      handler: (input) => generateRandomPasswordHandler(passCli, input),
    },
    {
      kind: "input",
      name: "generate_passphrase",
      description: "Generate a passphrase.",
      inputSchema: generatePassphraseInputSchema,
      handler: (input) => generatePassphraseHandler(passCli, input),
    },
    {
      kind: "input",
      name: "score_password",
      description: "Score password strength.",
      inputSchema: scorePasswordInputSchema,
      handler: (input) => scorePasswordHandler(passCli, input),
    },
    {
      kind: "input",
      name: "generate_totp",
      description: "Generate a TOTP token from a secret or otpauth URI.",
      inputSchema: generateTotpInputSchema,
      handler: (input) => generateTotpHandler(passCli, input),
    },
    {
      kind: "input",
      name: "list_vault_members",
      description: "List members for a vault by share ID or vault name.",
      inputSchema: listVaultMembersInputSchema,
      handler: (input) => listVaultMembersHandler(passCli, input),
    },
    {
      kind: "input",
      name: "update_vault_member",
      description: "Update a vault member role.",
      inputSchema: updateVaultMemberInputSchema,
      handler: (input) => updateVaultMemberHandler(passCli, input),
    },
    {
      kind: "input",
      name: "remove_vault_member",
      description: "Remove a member from a vault.",
      inputSchema: removeVaultMemberInputSchema,
      handler: (input) => removeVaultMemberHandler(passCli, input),
    },
    {
      kind: "input",
      name: "list_items",
      description: "List items for a vault or share with MCP pagination support for JSON output.",
      inputSchema: listItemsInputSchema,
      handler: (input) => listItemsHandler(passCli, input),
    },
    {
      kind: "input",
      name: "view_item",
      description:
        "View a specific item by URI or selectors, optionally returning a specific field.",
      inputSchema: viewItemInputSchema,
      handler: (input) => viewItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "generate_item_totp",
      description:
        "Generate TOTP code(s) for an item by URI or selectors, optionally targeting a specific field.",
      inputSchema: itemTotpInputSchema,
      handler: (input) => itemTotpHandler(passCli, input),
    },
    {
      kind: "input",
      name: "create_login_item",
      description: "Create a login item in a vault or share.",
      inputSchema: createLoginItemInputSchema,
      handler: (input) => createLoginItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "create_login_item_from_template",
      description: "Create a login item from template JSON.",
      inputSchema: createLoginItemFromTemplateInputSchema,
      handler: (input) => createLoginItemFromTemplateHandler(passCli, input),
    },
    {
      kind: "input",
      name: "create_note_item",
      description: "Create a note item in a vault or share.",
      inputSchema: createNoteItemInputSchema,
      handler: (input) => createNoteItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "create_credit_card_item",
      description: "Create a credit card item in a vault or share.",
      inputSchema: createCreditCardItemInputSchema,
      handler: (input) => createCreditCardItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "create_wifi_item",
      description: "Create a WiFi item in a vault or share.",
      inputSchema: createWifiItemInputSchema,
      handler: (input) => createWifiItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "create_custom_item",
      description: "Create a custom item from template payload in a vault or share.",
      inputSchema: createCustomItemInputSchema,
      handler: (input) => createCustomItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "create_identity_item",
      description: "Create an identity item from template payload in a vault or share.",
      inputSchema: createIdentityItemInputSchema,
      handler: (input) => createIdentityItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "move_item",
      description: "Move an item from one vault to another.",
      inputSchema: moveItemInputSchema,
      handler: (input) => moveItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "update_item",
      description: "Update an item using selectors and field assignments.",
      inputSchema: updateItemInputSchema,
      handler: (input) => updateItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "trash_item",
      description: "Move an item to trash by selectors.",
      inputSchema: trashItemInputSchema,
      handler: (input) => trashItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "untrash_item",
      description: "Restore an item from trash by selectors.",
      inputSchema: untrashItemInputSchema,
      handler: (input) => untrashItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "delete_item",
      description: "Delete an item by share ID and item ID.",
      inputSchema: deleteItemInputSchema,
      handler: (input) => deleteItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "download_item_attachment",
      description: "Download an item attachment to a local path.",
      inputSchema: downloadItemAttachmentInputSchema,
      handler: (input) => downloadItemAttachmentHandler(passCli, input),
    },
    {
      kind: "input",
      name: "create_item_alias",
      description: "Create an email alias item.",
      inputSchema: createItemAliasInputSchema,
      handler: (input) => createItemAliasHandler(passCli, input),
    },
    {
      kind: "input",
      name: "list_item_members",
      description: "List item members.",
      inputSchema: listItemMembersInputSchema,
      handler: (input) => listItemMembersHandler(passCli, input),
    },
    {
      kind: "input",
      name: "update_item_member",
      description: "Update an item member role.",
      inputSchema: updateItemMemberInputSchema,
      handler: (input) => updateItemMemberHandler(passCli, input),
    },
    {
      kind: "input",
      name: "remove_item_member",
      description: "Remove an item member.",
      inputSchema: removeItemMemberInputSchema,
      handler: (input) => removeItemMemberHandler(passCli, input),
    },
    {
      kind: "input",
      name: "share_item",
      description: "Share an item with a user.",
      inputSchema: shareItemInputSchema,
      handler: (input) => shareItemHandler(passCli, input),
    },
    {
      kind: "input",
      name: "search_items",
      description: "Search items by title with MCP pagination support for JSON output.",
      inputSchema: searchItemsInputSchema,
      handler: (input) => searchItemsHandler(passCli, input),
    },
  ];

  for (const tool of tools) {
    registerToolDefinition(server, tool);
  }
}

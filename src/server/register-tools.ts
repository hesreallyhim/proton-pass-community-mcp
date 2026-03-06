import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { withAuthErrorHandling } from "../pass-cli/errors.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import type { PassCliVersionPolicy } from "../pass-cli/version.js";
import { checkStatusHandler } from "../tools/check-status.js";
import { injectHandler, injectInputSchema, runHandler, runInputSchema } from "../tools/contents.js";
import {
  createItemAliasHandler,
  createItemAliasInputSchema,
  createLoginItemFromTemplateHandler,
  createLoginItemFromTemplateInputSchema,
  createLoginItemHandler,
  createLoginItemInputSchema,
  deleteItemHandler,
  deleteItemInputSchema,
  itemTotpHandler,
  itemTotpInputSchema,
  listItemsHandler,
  listItemsInputSchema,
  searchItemsHandler,
  searchItemsInputSchema,
  shareItemHandler,
  shareItemInputSchema,
  updateItemHandler,
  updateItemInputSchema,
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
  settingsSetDefaultFormatHandler,
  settingsSetDefaultFormatInputSchema,
  settingsSetDefaultVaultHandler,
  settingsSetDefaultVaultInputSchema,
  settingsUnsetDefaultFormatHandler,
  settingsUnsetDefaultFormatInputSchema,
  settingsUnsetDefaultVaultHandler,
  settingsUnsetDefaultVaultInputSchema,
  viewSettingsHandler,
} from "../tools/settings.js";
import { listSharesHandler, listSharesInputSchema } from "../tools/share.js";
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
  updateVaultMemberHandler,
  updateVaultMemberInputSchema,
  updateVaultHandler,
  updateVaultInputSchema,
  shareVaultHandler,
  shareVaultInputSchema,
  transferVaultHandler,
  transferVaultInputSchema,
} from "../tools/vault.js";

export function registerTools(
  server: McpServer,
  passCli: PassCliRunner,
  versionPolicy: PassCliVersionPolicy = {},
) {
  server.registerTool(
    "view_session_info",
    {
      description: "View current Proton Pass session/account summary from pass-cli info.",
    },
    withAuthErrorHandling(async () => viewSessionInfoHandler(passCli)),
  );

  server.registerTool(
    "check_status",
    {
      description:
        "Run preflight checks for connectivity/authentication and CLI version compatibility.",
    },
    async () => checkStatusHandler(passCli, versionPolicy),
  );

  server.registerTool(
    "inject",
    {
      description: "Inject secrets from Proton Pass references into a template file.",
      inputSchema: injectInputSchema,
    },
    withAuthErrorHandling(async (input) => injectHandler(passCli, input)),
  );

  server.registerTool(
    "run",
    {
      description: "Run a command with Proton Pass secret references resolved in environment.",
      inputSchema: runInputSchema,
    },
    withAuthErrorHandling(async (input) => runHandler(passCli, input)),
  );

  server.registerTool(
    "view_user_info",
    {
      description: "View Proton user profile/account details from pass-cli user info.",
      inputSchema: viewUserInfoInputSchema,
    },
    withAuthErrorHandling(async (input) => viewUserInfoHandler(passCli, input)),
  );

  server.registerTool(
    "list_vaults",
    {
      description: "List vaults accessible to the current authenticated user.",
      inputSchema: listVaultsInputSchema,
    },
    withAuthErrorHandling(async (input) => listVaultsHandler(passCli, input)),
  );

  server.registerTool(
    "create_vault",
    {
      description: "Create a new vault.",
      inputSchema: createVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => createVaultHandler(passCli, input)),
  );

  server.registerTool(
    "update_vault",
    {
      description: "Update a vault by share ID or vault name.",
      inputSchema: updateVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => updateVaultHandler(passCli, input)),
  );

  server.registerTool(
    "share_vault",
    {
      description: "Share a vault with a user.",
      inputSchema: shareVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => shareVaultHandler(passCli, input)),
  );

  server.registerTool(
    "transfer_vault",
    {
      description: "Transfer vault ownership to a member.",
      inputSchema: transferVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => transferVaultHandler(passCli, input)),
  );

  server.registerTool(
    "delete_vault",
    {
      description: "Delete a vault by share ID or vault name.",
      inputSchema: deleteVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => deleteVaultHandler(passCli, input)),
  );

  server.registerTool(
    "list_shares",
    {
      description: "List shares accessible to the current authenticated user.",
      inputSchema: listSharesInputSchema,
    },
    withAuthErrorHandling(async (input) => listSharesHandler(passCli, input)),
  );

  server.registerTool(
    "list_invites",
    {
      description: "List pending invitations accessible to the current authenticated user.",
      inputSchema: listInvitesInputSchema,
    },
    withAuthErrorHandling(async (input) => listInvitesHandler(passCli, input)),
  );

  server.registerTool(
    "accept_invite",
    {
      description: "Accept an invitation token.",
      inputSchema: inviteAcceptInputSchema,
    },
    withAuthErrorHandling(async (input) => inviteAcceptHandler(passCli, input)),
  );

  server.registerTool(
    "reject_invite",
    {
      description: "Reject an invitation token.",
      inputSchema: inviteRejectInputSchema,
    },
    withAuthErrorHandling(async (input) => inviteRejectHandler(passCli, input)),
  );

  server.registerTool(
    "view_settings",
    {
      description: "View current Proton Pass CLI settings.",
    },
    withAuthErrorHandling(async () => viewSettingsHandler(passCli)),
  );

  server.registerTool(
    "set_default_vault",
    {
      description: "Set default vault by share ID or vault name.",
      inputSchema: settingsSetDefaultVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => settingsSetDefaultVaultHandler(passCli, input)),
  );

  server.registerTool(
    "set_default_format",
    {
      description: "Set default output format (human/json).",
      inputSchema: settingsSetDefaultFormatInputSchema,
    },
    withAuthErrorHandling(async (input) => settingsSetDefaultFormatHandler(passCli, input)),
  );

  server.registerTool(
    "unset_default_vault",
    {
      description: "Unset default vault setting.",
      inputSchema: settingsUnsetDefaultVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => settingsUnsetDefaultVaultHandler(passCli, input)),
  );

  server.registerTool(
    "unset_default_format",
    {
      description: "Unset default output format setting.",
      inputSchema: settingsUnsetDefaultFormatInputSchema,
    },
    withAuthErrorHandling(async (input) => settingsUnsetDefaultFormatHandler(passCli, input)),
  );

  server.registerTool(
    "generate_random_password",
    {
      description: "Generate a random password.",
      inputSchema: generateRandomPasswordInputSchema,
    },
    withAuthErrorHandling(async (input) => generateRandomPasswordHandler(passCli, input)),
  );

  server.registerTool(
    "generate_passphrase",
    {
      description: "Generate a passphrase.",
      inputSchema: generatePassphraseInputSchema,
    },
    withAuthErrorHandling(async (input) => generatePassphraseHandler(passCli, input)),
  );

  server.registerTool(
    "score_password",
    {
      description: "Score password strength.",
      inputSchema: scorePasswordInputSchema,
    },
    withAuthErrorHandling(async (input) => scorePasswordHandler(passCli, input)),
  );

  server.registerTool(
    "list_vault_members",
    {
      description: "List members for a vault by share ID or vault name.",
      inputSchema: listVaultMembersInputSchema,
    },
    withAuthErrorHandling(async (input) => listVaultMembersHandler(passCli, input)),
  );

  server.registerTool(
    "update_vault_member",
    {
      description: "Update a vault member role.",
      inputSchema: updateVaultMemberInputSchema,
    },
    withAuthErrorHandling(async (input) => updateVaultMemberHandler(passCli, input)),
  );

  server.registerTool(
    "remove_vault_member",
    {
      description: "Remove a member from a vault.",
      inputSchema: removeVaultMemberInputSchema,
    },
    withAuthErrorHandling(async (input) => removeVaultMemberHandler(passCli, input)),
  );

  server.registerTool(
    "list_items",
    {
      description: "List items for a vault or share with MCP pagination support for JSON output.",
      inputSchema: listItemsInputSchema,
    },
    withAuthErrorHandling(async (input) => listItemsHandler(passCli, input)),
  );

  server.registerTool(
    "view_item",
    {
      description:
        "View a specific item by URI or selectors, optionally returning a specific field.",
      inputSchema: viewItemInputSchema,
    },
    withAuthErrorHandling(async (input) => viewItemHandler(passCli, input)),
  );

  server.registerTool(
    "generate_item_totp",
    {
      description:
        "Generate TOTP code(s) for an item by URI or selectors, optionally targeting a specific field.",
      inputSchema: itemTotpInputSchema,
    },
    withAuthErrorHandling(async (input) => itemTotpHandler(passCli, input)),
  );

  server.registerTool(
    "create_login_item",
    {
      description: "Create a login item in a vault or share.",
      inputSchema: createLoginItemInputSchema,
    },
    withAuthErrorHandling(async (input) => createLoginItemHandler(passCli, input)),
  );

  server.registerTool(
    "create_login_item_from_template",
    {
      description: "Create a login item from template JSON.",
      inputSchema: createLoginItemFromTemplateInputSchema,
    },
    withAuthErrorHandling(async (input) => createLoginItemFromTemplateHandler(passCli, input)),
  );

  server.registerTool(
    "update_item",
    {
      description: "Update an item using selectors and field assignments.",
      inputSchema: updateItemInputSchema,
    },
    withAuthErrorHandling(async (input) => updateItemHandler(passCli, input)),
  );

  server.registerTool(
    "delete_item",
    {
      description: "Delete an item by share ID and item ID.",
      inputSchema: deleteItemInputSchema,
    },
    withAuthErrorHandling(async (input) => deleteItemHandler(passCli, input)),
  );

  server.registerTool(
    "create_item_alias",
    {
      description: "Create an email alias item.",
      inputSchema: createItemAliasInputSchema,
    },
    withAuthErrorHandling(async (input) => createItemAliasHandler(passCli, input)),
  );

  server.registerTool(
    "share_item",
    {
      description: "Share an item with a user.",
      inputSchema: shareItemInputSchema,
    },
    withAuthErrorHandling(async (input) => shareItemHandler(passCli, input)),
  );

  server.registerTool(
    "search_items",
    {
      description: "Search items by title with MCP pagination support for JSON output.",
      inputSchema: searchItemsInputSchema,
    },
    withAuthErrorHandling(async (input) => searchItemsHandler(passCli, input)),
  );
}

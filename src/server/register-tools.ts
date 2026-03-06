import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { withAuthErrorHandling } from "../pass-cli/errors.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import type { PassCliVersionPolicy } from "../pass-cli/version.js";
import { checkStatusHandler } from "../tools/check-status.js";
import {
  createLoginItemHandler,
  createLoginItemInputSchema,
  createItemFromTemplateHandler,
  createItemFromTemplateInputSchema,
  deleteItemHandler,
  deleteItemInputSchema,
  itemTotpHandler,
  itemTotpInputSchema,
  listItemsHandler,
  listItemsInputSchema,
  searchItemsHandler,
  searchItemsInputSchema,
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
  updateVaultHandler,
  updateVaultInputSchema,
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
    "invite_accept",
    {
      description: "Accept an invitation token.",
      inputSchema: inviteAcceptInputSchema,
    },
    withAuthErrorHandling(async (input) => inviteAcceptHandler(passCli, input)),
  );

  server.registerTool(
    "invite_reject",
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
    "settings_set_default_vault",
    {
      description: "Set default vault by share ID or vault name.",
      inputSchema: settingsSetDefaultVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => settingsSetDefaultVaultHandler(passCli, input)),
  );

  server.registerTool(
    "settings_set_default_format",
    {
      description: "Set default output format (human/json).",
      inputSchema: settingsSetDefaultFormatInputSchema,
    },
    withAuthErrorHandling(async (input) => settingsSetDefaultFormatHandler(passCli, input)),
  );

  server.registerTool(
    "settings_unset_default_vault",
    {
      description: "Unset default vault setting.",
      inputSchema: settingsUnsetDefaultVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => settingsUnsetDefaultVaultHandler(passCli, input)),
  );

  server.registerTool(
    "settings_unset_default_format",
    {
      description: "Unset default output format setting.",
      inputSchema: settingsUnsetDefaultFormatInputSchema,
    },
    withAuthErrorHandling(async (input) => settingsUnsetDefaultFormatHandler(passCli, input)),
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
    "item_totp",
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
    "create_item_from_template",
    {
      description: "Create an item from template JSON.",
      inputSchema: createItemFromTemplateInputSchema,
    },
    withAuthErrorHandling(async (input) => createItemFromTemplateHandler(passCli, input)),
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
    "search_items",
    {
      description: "Search items by title with MCP pagination support for JSON output.",
      inputSchema: searchItemsInputSchema,
    },
    withAuthErrorHandling(async (input) => searchItemsHandler(passCli, input)),
  );
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { withAuthErrorHandling } from "../pass-cli/errors.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { checkStatusHandler } from "../tools/check-status.js";
import {
  createItemFromTemplateHandler,
  createLoginItemHandler,
  deleteItemHandler,
  deleteItemInputSchema,
  listItemsHandler,
  listItemsInputSchema,
  searchItemsHandler,
  searchItemsInputSchema,
  updateItemHandler,
  updateItemInputSchema,
  viewItemHandler,
  viewItemInputSchema,
  createLoginItemInputSchema,
  createItemFromTemplateInputSchema,
} from "../tools/item.js";
import {
  viewSessionInfoHandler,
  viewUserInfoHandler,
  viewUserInfoInputSchema,
} from "../tools/session.js";
import {
  createVaultHandler,
  createVaultInputSchema,
  deleteVaultHandler,
  deleteVaultInputSchema,
  listVaultsHandler,
  listVaultsInputSchema,
  updateVaultHandler,
  updateVaultInputSchema,
} from "../tools/vault.js";

export function registerTools(server: McpServer, passCli: PassCliRunner) {
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
    async () => checkStatusHandler(passCli),
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
    "search_items",
    {
      description: "Search items by title with MCP pagination support for JSON output.",
      inputSchema: searchItemsInputSchema,
    },
    withAuthErrorHandling(async (input) => searchItemsHandler(passCli, input)),
  );

  server.registerTool(
    "create_vault",
    {
      description: "Create a new vault (write-gated).",
      inputSchema: createVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => createVaultHandler(passCli, input)),
  );

  server.registerTool(
    "update_vault",
    {
      description:
        "Update vault metadata (currently rename) by share ID or vault name (write-gated).",
      inputSchema: updateVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => updateVaultHandler(passCli, input)),
  );

  server.registerTool(
    "delete_vault",
    {
      description: "Delete a vault by share ID or vault name (write-gated).",
      inputSchema: deleteVaultInputSchema,
    },
    withAuthErrorHandling(async (input) => deleteVaultHandler(passCli, input)),
  );

  server.registerTool(
    "create_login_item",
    {
      description: "Create a login-type item in a vault/share (write-gated).",
      inputSchema: createLoginItemInputSchema,
    },
    withAuthErrorHandling(async (input) => createLoginItemHandler(passCli, input)),
  );

  server.registerTool(
    "create_item_from_template",
    {
      description: "Create an item from a JSON template payload (write-gated).",
      inputSchema: createItemFromTemplateInputSchema,
    },
    withAuthErrorHandling(async (input) => createItemFromTemplateHandler(passCli, input)),
  );

  server.registerTool(
    "update_item",
    {
      description: "Update item fields by item ID or title selectors (write-gated).",
      inputSchema: updateItemInputSchema,
    },
    withAuthErrorHandling(async (input) => updateItemHandler(passCli, input)),
  );

  server.registerTool(
    "delete_item",
    {
      description: "Delete an item by share ID and item ID (write-gated).",
      inputSchema: deleteItemInputSchema,
    },
    withAuthErrorHandling(async (input) => deleteItemHandler(passCli, input)),
  );
}

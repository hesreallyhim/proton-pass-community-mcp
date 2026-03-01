import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { withAuthErrorHandling } from "../pass-cli/errors.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { passCheckStatusHandler } from "../tools/check-status.js";
import {
  passItemCreateFromTemplateHandler,
  passItemCreateLoginHandler,
  passItemDeleteHandler,
  passItemDeleteInputSchema,
  passItemListHandler,
  passItemListInputSchema,
  passItemUpdateHandler,
  passItemUpdateInputSchema,
  passItemViewHandler,
  passItemViewInputSchema,
  passItemCreateLoginInputSchema,
  passItemCreateFromTemplateInputSchema,
} from "../tools/item.js";
import { passInfoHandler, passUserInfoHandler, passUserInfoInputSchema } from "../tools/session.js";
import {
  passVaultCreateHandler,
  passVaultCreateInputSchema,
  passVaultDeleteHandler,
  passVaultDeleteInputSchema,
  passVaultListHandler,
  passVaultListInputSchema,
  passVaultUpdateHandler,
  passVaultUpdateInputSchema,
} from "../tools/vault.js";

export function registerTools(server: McpServer, passCli: PassCliRunner) {
  server.registerTool(
    "view_session_info",
    {
      description: "View current Proton Pass session/account summary from pass-cli info.",
    },
    withAuthErrorHandling(async () => passInfoHandler(passCli)),
  );

  server.registerTool(
    "check_status",
    {
      description:
        "Run preflight checks for connectivity/authentication and CLI version compatibility.",
    },
    async () => passCheckStatusHandler(passCli),
  );

  server.registerTool(
    "view_user_info",
    {
      description: "View Proton user profile/account details from pass-cli user info.",
      inputSchema: passUserInfoInputSchema,
    },
    withAuthErrorHandling(async (input) => passUserInfoHandler(passCli, input)),
  );

  server.registerTool(
    "list_vaults",
    {
      description: "List vaults accessible to the current authenticated user.",
      inputSchema: passVaultListInputSchema,
    },
    withAuthErrorHandling(async (input) => passVaultListHandler(passCli, input)),
  );

  server.registerTool(
    "list_items",
    {
      description: "List items for a vault or share with MCP pagination support for JSON output.",
      inputSchema: passItemListInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemListHandler(passCli, input)),
  );

  server.registerTool(
    "view_item",
    {
      description:
        "View a specific item by URI or selectors, optionally returning a specific field.",
      inputSchema: passItemViewInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemViewHandler(passCli, input)),
  );

  server.registerTool(
    "create_vault",
    {
      description: "Create a new vault (write-gated).",
      inputSchema: passVaultCreateInputSchema,
    },
    withAuthErrorHandling(async (input) => passVaultCreateHandler(passCli, input)),
  );

  server.registerTool(
    "update_vault",
    {
      description:
        "Update vault metadata (currently rename) by share ID or vault name (write-gated).",
      inputSchema: passVaultUpdateInputSchema,
    },
    withAuthErrorHandling(async (input) => passVaultUpdateHandler(passCli, input)),
  );

  server.registerTool(
    "delete_vault",
    {
      description: "Delete a vault by share ID or vault name (write-gated).",
      inputSchema: passVaultDeleteInputSchema,
    },
    withAuthErrorHandling(async (input) => passVaultDeleteHandler(passCli, input)),
  );

  server.registerTool(
    "create_login_item",
    {
      description: "Create a login-type item in a vault/share (write-gated).",
      inputSchema: passItemCreateLoginInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemCreateLoginHandler(passCli, input)),
  );

  server.registerTool(
    "create_item_from_template",
    {
      description: "Create an item from a JSON template payload (write-gated).",
      inputSchema: passItemCreateFromTemplateInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemCreateFromTemplateHandler(passCli, input)),
  );

  server.registerTool(
    "update_item",
    {
      description: "Update item fields by item ID or title selectors (write-gated).",
      inputSchema: passItemUpdateInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemUpdateHandler(passCli, input)),
  );

  server.registerTool(
    "delete_item",
    {
      description: "Delete an item by share ID and item ID (write-gated).",
      inputSchema: passItemDeleteInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemDeleteHandler(passCli, input)),
  );
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { withAuthErrorHandling } from "../pass-cli/errors.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { checkStatusHandler } from "../tools/check-status.js";
import {
  listItemsHandler,
  listItemsInputSchema,
  searchItemsHandler,
  searchItemsInputSchema,
  viewItemHandler,
  viewItemInputSchema,
} from "../tools/item.js";
import {
  viewSessionInfoHandler,
  viewUserInfoHandler,
  viewUserInfoInputSchema,
} from "../tools/session.js";
import { listSharesHandler, listSharesInputSchema } from "../tools/share.js";
import { listVaultsHandler, listVaultsInputSchema } from "../tools/vault.js";

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
    "list_shares",
    {
      description: "List shares accessible to the current authenticated user.",
      inputSchema: listSharesInputSchema,
    },
    withAuthErrorHandling(async (input) => listSharesHandler(passCli, input)),
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
  // Release 0.1 intentionally does not register mutative tools.
}

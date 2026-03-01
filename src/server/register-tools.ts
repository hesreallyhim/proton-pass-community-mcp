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
    {},
    withAuthErrorHandling(async () => passInfoHandler(passCli)),
  );

  server.registerTool("check_status", {}, async () => passCheckStatusHandler(passCli));

  server.registerTool(
    "view_user_info",
    {
      inputSchema: passUserInfoInputSchema,
    },
    withAuthErrorHandling(async (input) => passUserInfoHandler(passCli, input)),
  );

  server.registerTool(
    "list_vaults",
    {
      inputSchema: passVaultListInputSchema,
    },
    withAuthErrorHandling(async (input) => passVaultListHandler(passCli, input)),
  );

  server.registerTool(
    "list_items",
    {
      inputSchema: passItemListInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemListHandler(passCli, input)),
  );

  server.registerTool(
    "view_item",
    {
      inputSchema: passItemViewInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemViewHandler(passCli, input)),
  );

  server.registerTool(
    "create_vault",
    { inputSchema: passVaultCreateInputSchema },
    withAuthErrorHandling(async (input) => passVaultCreateHandler(passCli, input)),
  );

  server.registerTool(
    "update_vault",
    {
      inputSchema: passVaultUpdateInputSchema,
    },
    withAuthErrorHandling(async (input) => passVaultUpdateHandler(passCli, input)),
  );

  server.registerTool(
    "delete_vault",
    {
      inputSchema: passVaultDeleteInputSchema,
    },
    withAuthErrorHandling(async (input) => passVaultDeleteHandler(passCli, input)),
  );

  server.registerTool(
    "create_login_item",
    {
      inputSchema: passItemCreateLoginInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemCreateLoginHandler(passCli, input)),
  );

  server.registerTool(
    "create_item_from_template",
    {
      inputSchema: passItemCreateFromTemplateInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemCreateFromTemplateHandler(passCli, input)),
  );

  server.registerTool(
    "update_item",
    {
      inputSchema: passItemUpdateInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemUpdateHandler(passCli, input)),
  );

  server.registerTool(
    "delete_item",
    {
      inputSchema: passItemDeleteInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemDeleteHandler(passCli, input)),
  );
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  getItemCreateTemplateByType,
  getItemCreateTemplateSnapshot,
  listItemCreateTemplateTypes,
} from "../resources/item-create-templates.js";

const ITEM_TEMPLATE_INDEX_URI = "pass://templates/item-create";
const ITEM_TEMPLATE_URI_PREFIX = `${ITEM_TEMPLATE_INDEX_URI}/`;

function makeJsonResource(uri: string, payload: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function typeToResourceName(type: string): string {
  return `item_create_template_${type.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
}

export function registerResources(server: McpServer) {
  const snapshot = getItemCreateTemplateSnapshot();
  const types = listItemCreateTemplateTypes();

  const indexPayload = {
    kind: "item-create-template-catalog",
    captured_at: snapshot.captured_at,
    captured_by: snapshot.captured_by,
    pass_cli_version: snapshot.pass_cli_version,
    template_types: types,
    resources: types.map((type) => `${ITEM_TEMPLATE_URI_PREFIX}${type}`),
  };

  server.registerResource(
    "item_create_templates",
    ITEM_TEMPLATE_INDEX_URI,
    {
      title: "Item Create Template Catalog",
      description: "Catalog of pass-cli item create templates captured for dev/testing.",
      mimeType: "application/json",
    },
    async () => makeJsonResource(ITEM_TEMPLATE_INDEX_URI, indexPayload),
  );

  for (const type of types) {
    const uri = `${ITEM_TEMPLATE_URI_PREFIX}${type}`;
    server.registerResource(
      typeToResourceName(type),
      uri,
      {
        title: `Item Create Template: ${type}`,
        description: `Template snapshot for pass-cli item create ${type}.`,
        mimeType: "application/json",
      },
      async () =>
        makeJsonResource(uri, {
          kind: "item-create-template",
          type,
          captured_at: snapshot.captured_at,
          pass_cli_version: snapshot.pass_cli_version,
          template: getItemCreateTemplateByType(type),
        }),
    );
  }
}

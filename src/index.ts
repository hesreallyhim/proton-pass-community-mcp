#!/usr/bin/env node

import { parseStartupCliFlags } from "./cli-flags.js";
import { resolveAllowVersionDrift } from "./cli-flags.js";
import { startServer } from "./server.js";

const flags = parseStartupCliFlags(process.argv.slice(2));
const allowVersionDrift = resolveAllowVersionDrift(flags);

await startServer({
  createServerDeps: {
    versionPolicy: {
      allowVersionDrift,
    },
  },
});

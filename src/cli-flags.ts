export type StartupCliFlags = {
  allowVersionDrift?: boolean;
};

function parseBooleanFlagValue(raw: string, flagName: string): boolean {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  throw new Error(`Invalid value for ${flagName}: "${raw}" (expected true/false).`);
}

export function parseStartupCliFlags(args: readonly string[]): StartupCliFlags {
  const flags: StartupCliFlags = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--allow-version-drift") {
      flags.allowVersionDrift = true;
      continue;
    }

    const prefix = "--allow-version-drift=";
    if (arg.startsWith(prefix)) {
      flags.allowVersionDrift = parseBooleanFlagValue(
        arg.slice(prefix.length),
        "--allow-version-drift",
      );
      continue;
    }
  }

  return flags;
}

export function parseAllowVersionDriftEnv(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  return parseBooleanFlagValue(raw, "PASS_CLI_ALLOW_VERSION_DRIFT");
}

export function resolveAllowVersionDrift(
  flags: StartupCliFlags,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    flags.allowVersionDrift ?? parseAllowVersionDriftEnv(env.PASS_CLI_ALLOW_VERSION_DRIFT) ?? false
  );
}

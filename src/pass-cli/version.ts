import type { PassCliRunner } from "./runner.js";
import { joinStdoutStderr } from "./output.js";

const DEFAULT_PINNED_PASS_CLI_VERSION = "1.5.2";

type Semver = { major: number; minor: number; patch: number };
type CompatibilityStatus = "ok" | "warn" | "error" | "unknown";

export type PassCliVersionStatus = {
  pinnedVersion: string;
  detectedVersion: string | null;
  detectedRaw: string;
  compatibilityStatus: CompatibilityStatus;
  reason: string;
};

export function parseSemver(text: string): Semver | null {
  const match = (text ?? "").match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (![major, minor, patch].every((n) => Number.isSafeInteger(n))) {
    return null;
  }

  return { major, minor, patch };
}

export function evaluatePassCliCompatibility(
  detected: Semver,
  pinned: Semver,
): { compatibilityStatus: Exclude<CompatibilityStatus, "unknown">; reason: string } {
  if (detected.major !== pinned.major) {
    return {
      compatibilityStatus: "error",
      reason: `Major version mismatch (detected ${detected.major}, expected ${pinned.major}).`,
    };
  }

  if (detected.minor < pinned.minor) {
    return {
      compatibilityStatus: "error",
      reason: `Detected minor version ${detected.minor} is lower than required ${pinned.minor}.`,
    };
  }

  if (detected.minor > pinned.minor) {
    return {
      compatibilityStatus: "warn",
      reason: `Detected minor version ${detected.minor} is newer than pinned ${pinned.minor}.`,
    };
  }

  if (detected.patch !== pinned.patch) {
    return {
      compatibilityStatus: "warn",
      reason: `Patch version differs (detected ${detected.patch}, pinned ${pinned.patch}).`,
    };
  }

  return {
    compatibilityStatus: "ok",
    reason: "Detected version matches pinned version.",
  };
}

function getPinnedPassCliVersion(): string {
  return process.env.PASS_CLI_PINNED_VERSION || DEFAULT_PINNED_PASS_CLI_VERSION;
}

export async function checkPassCliVersion(passCli: PassCliRunner): Promise<PassCliVersionStatus> {
  const pinnedVersion = getPinnedPassCliVersion();
  const pinnedSemver = parseSemver(pinnedVersion);
  if (!pinnedSemver) {
    return {
      pinnedVersion,
      detectedVersion: null,
      detectedRaw: "",
      compatibilityStatus: "error",
      reason: `Configured pinned version "${pinnedVersion}" is not valid semver.`,
    };
  }

  try {
    const { stdout, stderr } = await passCli(["--version"]);
    const detectedRaw = joinStdoutStderr(stdout, stderr);
    const detectedSemver = parseSemver(detectedRaw);

    if (!detectedSemver) {
      return {
        pinnedVersion,
        detectedVersion: null,
        detectedRaw,
        compatibilityStatus: "unknown",
        reason: "Could not parse semantic version from pass-cli --version output.",
      };
    }

    const { compatibilityStatus, reason } = evaluatePassCliCompatibility(
      detectedSemver,
      pinnedSemver,
    );
    return {
      pinnedVersion,
      detectedVersion: `${detectedSemver.major}.${detectedSemver.minor}.${detectedSemver.patch}`,
      detectedRaw,
      compatibilityStatus,
      reason,
    };
  } catch (error) {
    return {
      pinnedVersion,
      detectedVersion: null,
      detectedRaw: error instanceof Error ? error.message : String(error),
      compatibilityStatus: "error",
      reason: 'Failed to execute "pass-cli --version".',
    };
  }
}

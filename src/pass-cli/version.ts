import type { PassCliRunner } from "./runner.js";
import { joinStdoutStderr } from "./output.js";

const PROJECT_PASS_CLI_BASELINE_VERSION = "1.5.2";

type Semver = { major: number; minor: number; patch: number };
type CompatibilityStatus = "equal" | "compatible" | "possibly_incompatible";

export type PassCliVersionPolicy = {
  allowVersionDrift?: boolean;
};

export type PassCliVersionStatus = {
  baselineVersion: string;
  detectedVersion: string | null;
  detectedRaw: string;
  compatibilityStatus: CompatibilityStatus;
  reason: string;
  allowVersionDrift: boolean;
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
  policy: PassCliVersionPolicy = {},
): { compatibilityStatus: CompatibilityStatus; reason: string } {
  const allowVersionDrift = policy.allowVersionDrift === true;

  if (detected.major !== pinned.major) {
    return {
      compatibilityStatus: allowVersionDrift ? "compatible" : "possibly_incompatible",
      reason: allowVersionDrift
        ? `Major mismatch detected (${detected.major} vs ${pinned.major}), but version-drift override is enabled.`
        : `Major mismatch detected (${detected.major} vs ${pinned.major}); this may be incompatible.`,
    };
  }

  if (detected.minor < pinned.minor) {
    return {
      compatibilityStatus: allowVersionDrift ? "compatible" : "possibly_incompatible",
      reason: allowVersionDrift
        ? `Detected minor version ${detected.minor} is lower than baseline ${pinned.minor}, but version-drift override is enabled.`
        : `Detected minor version ${detected.minor} is lower than baseline ${pinned.minor}; this may be incompatible.`,
    };
  }

  if (detected.minor > pinned.minor) {
    return {
      compatibilityStatus: "compatible",
      reason: `Detected minor version ${detected.minor} is newer than baseline ${pinned.minor}.`,
    };
  }

  if (detected.patch !== pinned.patch) {
    return {
      compatibilityStatus: "compatible",
      reason: `Patch differs (detected ${detected.patch}, baseline ${pinned.patch}).`,
    };
  }

  return {
    compatibilityStatus: "equal",
    reason: "Detected version exactly matches the baseline.",
  };
}

function getProjectBaselinePassCliVersion(): string {
  return PROJECT_PASS_CLI_BASELINE_VERSION;
}

export async function checkPassCliVersion(
  passCli: PassCliRunner,
  policy: PassCliVersionPolicy = {},
): Promise<PassCliVersionStatus> {
  const baselineVersion = getProjectBaselinePassCliVersion();
  const allowVersionDrift = policy.allowVersionDrift === true;
  const baselineSemver = parseSemver(baselineVersion);
  if (!baselineSemver) {
    return {
      baselineVersion,
      detectedVersion: null,
      detectedRaw: "",
      compatibilityStatus: allowVersionDrift ? "compatible" : "possibly_incompatible",
      reason: allowVersionDrift
        ? `Baseline version "${baselineVersion}" is not valid semver, but version-drift override is enabled.`
        : `Baseline version "${baselineVersion}" is not valid semver; compatibility can only be inferred.`,
      allowVersionDrift,
    };
  }

  try {
    const { stdout, stderr } = await passCli(["--version"]);
    const detectedRaw = joinStdoutStderr(stdout, stderr);
    const detectedSemver = parseSemver(detectedRaw);

    if (!detectedSemver) {
      return {
        baselineVersion,
        detectedVersion: null,
        detectedRaw,
        compatibilityStatus: allowVersionDrift ? "compatible" : "possibly_incompatible",
        reason: allowVersionDrift
          ? "Could not parse semantic version from pass-cli --version output, but version-drift override is enabled."
          : "Could not parse semantic version from pass-cli --version output; compatibility can only be inferred.",
        allowVersionDrift,
      };
    }

    const { compatibilityStatus, reason } = evaluatePassCliCompatibility(
      detectedSemver,
      baselineSemver,
      policy,
    );
    return {
      baselineVersion,
      detectedVersion: `${detectedSemver.major}.${detectedSemver.minor}.${detectedSemver.patch}`,
      detectedRaw,
      compatibilityStatus,
      reason,
      allowVersionDrift,
    };
  } catch (error) {
    return {
      baselineVersion,
      detectedVersion: null,
      detectedRaw: error instanceof Error ? error.message : String(error),
      compatibilityStatus: allowVersionDrift ? "compatible" : "possibly_incompatible",
      reason: allowVersionDrift
        ? 'Failed to execute "pass-cli --version", but version-drift override is enabled.'
        : 'Failed to execute "pass-cli --version"; compatibility can only be inferred.',
      allowVersionDrift,
    };
  }
}

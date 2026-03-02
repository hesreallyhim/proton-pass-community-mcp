import { PassCliAuthError, type PassCliAuthErrorCode } from "../pass-cli/errors.js";
import { joinStdoutStderr } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { checkPassCliVersion } from "../pass-cli/version.js";

export type PassConnectivityStatus = {
  status: "ok" | "error";
  message: string;
  authErrorCode?: PassCliAuthErrorCode;
  retryable?: boolean;
  userAction?: string;
  authManagedByUser?: boolean;
};

export async function checkPassConnectivity(
  passCli: PassCliRunner,
): Promise<PassConnectivityStatus> {
  try {
    const { stdout, stderr } = await passCli(["test"]);
    const out = joinStdoutStderr(stdout, stderr);
    return {
      status: "ok",
      message: out || "Connection test succeeded.",
    };
  } catch (error) {
    if (error instanceof PassCliAuthError) {
      return {
        status: "error",
        message: error.message,
        authErrorCode: error.code,
        retryable: error.retryable,
        userAction: error.userAction,
        authManagedByUser: true,
      };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkStatusHandler(passCli: PassCliRunner) {
  const [version, connectivity] = await Promise.all([
    checkPassCliVersion(passCli),
    checkPassConnectivity(passCli),
  ]);

  const overallStatus: "ok" | "warn" | "error" =
    connectivity.status === "error" || version.compatibilityStatus === "error"
      ? "error"
      : version.compatibilityStatus === "warn" || version.compatibilityStatus === "unknown"
        ? "warn"
        : "ok";

  const structuredContent: Record<string, unknown> = {
    overall_status: overallStatus,
    connectivity,
    version,
  };

  if (connectivity.authErrorCode) {
    structuredContent.error_code = connectivity.authErrorCode;
    structuredContent.retryable = connectivity.retryable ?? true;
    structuredContent.user_action = connectivity.userAction;
    structuredContent.auth_managed_by_user = true;
  }

  const summary = [
    `Overall status: ${overallStatus.toUpperCase()}`,
    `Connectivity: ${connectivity.status.toUpperCase()} - ${connectivity.message}`,
    `Version compatibility: ${version.compatibilityStatus.toUpperCase()} - ${version.reason}`,
    `Pinned version: ${version.pinnedVersion}`,
    `Detected version: ${version.detectedVersion ?? "unknown"}${
      version.detectedRaw ? ` (${version.detectedRaw})` : ""
    }`,
  ].join("\n");

  return {
    ...(overallStatus === "error" ? { isError: true as const } : {}),
    content: [{ type: "text" as const, text: summary }],
    structuredContent,
  };
}

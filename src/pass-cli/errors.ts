export type PassCliAuthErrorCode = "AUTH_REQUIRED" | "AUTH_EXPIRED";

export class PassCliAuthError extends Error {
  readonly name = "PassCliAuthError";
  readonly retryable = true;
  readonly userAction = 'Run "pass-cli login" outside MCP, then retry this tool.';

  constructor(
    readonly code: PassCliAuthErrorCode,
    readonly details?: string,
  ) {
    const description =
      code === "AUTH_EXPIRED"
        ? "Proton Pass session expired."
        : "Proton Pass authentication is required.";
    super(
      `[${code}] ${description} Authentication is user-managed outside MCP. ` +
        "Do not provide credentials, OTP codes, or keys to the model. " +
        'Run "pass-cli login" in your terminal and retry.',
    );
  }
}

export function classifyPassCliAuthErrorText(text: string): PassCliAuthErrorCode | null {
  const normalized = (text ?? "").toLowerCase();

  if (
    normalized.includes("session expired") ||
    normalized.includes("expired session") ||
    (normalized.includes("token") && normalized.includes("expired"))
  ) {
    return "AUTH_EXPIRED";
  }

  if (
    normalized.includes("not logged in") ||
    normalized.includes("please login") ||
    normalized.includes("please log in") ||
    normalized.includes("requires an authenticated client") ||
    normalized.includes("authentication required") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return "AUTH_REQUIRED";
  }

  return null;
}

function asAuthErrorToolResult(error: PassCliAuthError) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: error.message }],
    structuredContent: {
      error_code: error.code,
      retryable: error.retryable,
      user_action: error.userAction,
      auth_managed_by_user: true,
    },
  };
}

export function withAuthErrorHandling<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>,
) {
  return async (...args: TArgs): Promise<TResult | ReturnType<typeof asAuthErrorToolResult>> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof PassCliAuthError) {
        return asAuthErrorToolResult(error);
      }
      throw error;
    }
  };
}

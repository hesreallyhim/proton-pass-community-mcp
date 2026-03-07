export function asTextContent(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function joinStdoutStderr(stdout: string, stderr: string): string {
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

export function asJsonTextOrRaw(text: string): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  try {
    const obj = JSON.parse(trimmed);
    return JSON.stringify(obj, null, 2);
  } catch {
    return trimmed;
  }
}

export function asWriteResult(stdout: string, stderr: string) {
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

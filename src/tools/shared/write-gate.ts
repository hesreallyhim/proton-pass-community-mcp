export function requireWriteGate(confirm?: boolean) {
  if (process.env.ALLOW_WRITE !== "1") {
    throw new Error("Write operations are disabled. Set ALLOW_WRITE=1 to enable.");
  }
  if (confirm !== true) {
    throw new Error('Write operation requires explicit confirmation: set {"confirm": true}.');
  }
}

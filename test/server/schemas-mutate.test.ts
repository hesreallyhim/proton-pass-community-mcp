import { describe, expect, it } from "vitest";

import {
  type DeleteItemInput,
  deleteItemInputSchema,
  type DownloadItemAttachmentInput,
  downloadItemAttachmentInputSchema,
  type MoveItemInput,
  moveItemInputSchema,
  type TrashItemInput,
  trashItemInputSchema,
  type UntrashItemInput,
  untrashItemInputSchema,
  type UpdateItemInput,
  updateItemInputSchema,
} from "../../src/tools/item/schemas-mutate.js";

// These tests target the zod schemas in `src/tools/item/schemas-mutate.ts`
// directly, exercising the refinements and field-level constraints rather
// than the handler-layer JS validation. See test-plan notes for divergences
// between schema- and handler-level contracts.

const STR_100 = "x".repeat(100);
const STR_101 = "x".repeat(101);
const STR_255 = "x".repeat(255);
const STR_256 = "x".repeat(256);
const STR_1024 = "x".repeat(1024);
const STR_1025 = "x".repeat(1025);
const STR_4096 = "x".repeat(4096);
const STR_4097 = "x".repeat(4097);

function expectIssueWithMessage(
  result: { success: false; error: { issues: { message: string }[] } } | { success: true },
  message: string,
): void {
  expect(result.success).toBe(false);
  if (result.success) return;
  const messages = result.error.issues.map((i) => i.message);
  expect(messages.some((m) => m.includes(message))).toBe(true);
}

describe("moveItemInputSchema", () => {
  it("accepts a valid input with one selector from each pair", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: "src-share",
      toVaultName: "Dest Vault",
      itemId: "item-123",
      confirm: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts confirm: false", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: "a",
      toVaultName: "b",
      itemId: "i",
      confirm: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts confirm omitted (optional)", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: "a",
      toVaultName: "b",
      itemId: "i",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when fromShareId AND fromVaultName are both set", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: "a",
      fromVaultName: "Vault",
      toVaultName: "Dest",
      itemId: "i",
    });
    expectIssueWithMessage(result, "Provide exactly one of fromShareId or fromVaultName.");
  });

  it("rejects when neither fromShareId nor fromVaultName are set", () => {
    const result = moveItemInputSchema.safeParse({
      toVaultName: "Dest",
      itemId: "i",
    });
    expectIssueWithMessage(result, "Provide exactly one of fromShareId or fromVaultName.");
  });

  it("rejects when toShareId AND toVaultName are both set", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: "a",
      toShareId: "x",
      toVaultName: "Dest",
      itemId: "i",
    });
    expectIssueWithMessage(result, "Provide exactly one of toShareId or toVaultName.");
  });

  it("rejects when neither toShareId nor toVaultName are set", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: "a",
      itemId: "i",
    });
    expectIssueWithMessage(result, "Provide exactly one of toShareId or toVaultName.");
  });

  it("rejects when itemId AND itemTitle are both set", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: "a",
      toVaultName: "Dest",
      itemId: "i",
      itemTitle: "T",
    });
    expectIssueWithMessage(result, "Provide exactly one of itemId or itemTitle.");
  });

  it("rejects when neither itemId nor itemTitle are set", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: "a",
      toVaultName: "Dest",
    });
    expectIssueWithMessage(result, "Provide exactly one of itemId or itemTitle.");
  });

  it("accepts fromShareId at exactly 100 chars", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: STR_100,
      toVaultName: "Dest",
      itemId: "i",
    });
    expect(result.success).toBe(true);
  });

  it("rejects fromShareId over 100 chars", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: STR_101,
      toVaultName: "Dest",
      itemId: "i",
    });
    expect(result.success).toBe(false);
  });

  it("accepts fromVaultName at exactly 255 chars", () => {
    const result = moveItemInputSchema.safeParse({
      fromVaultName: STR_255,
      toShareId: "x",
      itemId: "i",
    });
    expect(result.success).toBe(true);
  });

  it("rejects fromVaultName over 255 chars", () => {
    const result = moveItemInputSchema.safeParse({
      fromVaultName: STR_256,
      toShareId: "x",
      itemId: "i",
    });
    expect(result.success).toBe(false);
  });

  it("rejects itemTitle over 255 chars", () => {
    const result = moveItemInputSchema.safeParse({
      fromShareId: "a",
      toVaultName: "Dest",
      itemTitle: STR_256,
    });
    expect(result.success).toBe(false);
  });

  it("type-inference smoke: literal assignable to MoveItemInput", () => {
    const value: MoveItemInput = {
      fromShareId: "a",
      toVaultName: "b",
      itemId: "i",
      confirm: true,
    };
    expect(value.fromShareId).toBe("a");
  });
});

describe("updateItemInputSchema", () => {
  it("accepts a minimal valid input (item selector + fields)", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      itemId: "i",
      fields: ["username=alice"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full valid input", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "share-1",
      itemId: "item-1",
      fields: ["a=1", "b=2"],
      confirm: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts vaultName + itemTitle", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      vaultName: "Work",
      itemTitle: "GitHub",
      fields: ["x=1"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts neither shareId nor vaultName (scope is optional)", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      itemId: "i",
      fields: ["x=1"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when shareId AND vaultName are both set", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      vaultName: "v",
      itemId: "i",
      fields: ["x=1"],
    });
    expectIssueWithMessage(result, "Provide only one of shareId or vaultName.");
  });

  it("rejects when itemId AND itemTitle are both set", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      itemTitle: "T",
      fields: ["x=1"],
    });
    expectIssueWithMessage(result, "Provide exactly one of itemId or itemTitle.");
  });

  it("rejects when neither itemId nor itemTitle are set", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      fields: ["x=1"],
    });
    expectIssueWithMessage(result, "Provide exactly one of itemId or itemTitle.");
  });

  it("rejects missing fields (required)", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty fields array (min 1)", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      fields: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-array fields value", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      fields: "username=alice",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a fields entry at exactly 1024 chars", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      itemId: "i",
      fields: [STR_1024],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fields entry over 1024 chars", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      itemId: "i",
      fields: [STR_1025],
    });
    expect(result.success).toBe(false);
  });

  it("rejects shareId over 100 chars", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: STR_101,
      itemId: "i",
      fields: ["x=1"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects vaultName over 255 chars", () => {
    const result = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      vaultName: STR_256,
      itemId: "i",
      fields: ["x=1"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts confirm: false and omitted", () => {
    const a = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      itemId: "i",
      fields: ["x=1"],
      confirm: false,
    });
    const b = updateItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      itemId: "i",
      fields: ["x=1"],
    });
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
  });

  it("type-inference smoke: literal assignable to UpdateItemInput", () => {
    const value: UpdateItemInput = {
      shareId: "s",
      itemId: "i",
      fields: ["x=1"],
      confirm: true,
    };
    expect(value.fields[0]).toBe("x=1");
  });
});

describe("trashItemInputSchema", () => {
  it("accepts a valid input with shareId + itemId", () => {
    const result = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      confirm: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid input with vaultName + itemTitle", () => {
    const result = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      vaultName: "Vault",
      itemTitle: "T",
    });
    expect(result.success).toBe(true);
  });

  // NOTE: divergence with handler-helpers.ts:ensureSingleOptionalScope —
  // the schema's refinement only forbids BOTH being set; it allows NEITHER.
  // The handler-helper enforces "exactly one" at runtime. We test the
  // schema as written.
  it("accepts neither shareId nor vaultName (schema only forbids both-set)", () => {
    const result = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      itemId: "i",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when shareId AND vaultName are both set", () => {
    const result = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      vaultName: "v",
      itemId: "i",
    });
    expectIssueWithMessage(result, "Provide only one of shareId or vaultName.");
  });

  it("rejects when itemId AND itemTitle are both set", () => {
    const result = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      itemTitle: "T",
    });
    expectIssueWithMessage(result, "Provide exactly one of itemId or itemTitle.");
  });

  it("rejects when neither itemId nor itemTitle are set", () => {
    const result = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
    });
    expectIssueWithMessage(result, "Provide exactly one of itemId or itemTitle.");
  });

  it("rejects shareId over 100 chars", () => {
    const result = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: STR_101,
      itemId: "i",
    });
    expect(result.success).toBe(false);
  });

  it("rejects vaultName over 255 chars", () => {
    const result = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      vaultName: STR_256,
      itemId: "i",
    });
    expect(result.success).toBe(false);
  });

  it("accepts confirm true/false/undefined", () => {
    const a = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      confirm: true,
    });
    const b = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      confirm: false,
    });
    const c = trashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
    });
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(c.success).toBe(true);
  });

  it("type-inference smoke: literal assignable to TrashItemInput", () => {
    const value: TrashItemInput = { shareId: "s", itemId: "i", confirm: true };
    expect(value.shareId).toBe("s");
  });
});

describe("untrashItemInputSchema", () => {
  it("accepts a valid input with shareId + itemId", () => {
    const result = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      confirm: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid input with vaultName + itemTitle", () => {
    const result = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      vaultName: "v",
      itemTitle: "T",
    });
    expect(result.success).toBe(true);
  });

  // NOTE: same divergence with handler-helpers.ts as trashItemInputSchema —
  // schema allows neither scope to be set; handler requires exactly one.
  it("accepts neither shareId nor vaultName (schema only forbids both-set)", () => {
    const result = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      itemId: "i",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when shareId AND vaultName are both set", () => {
    const result = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      vaultName: "v",
      itemId: "i",
    });
    expectIssueWithMessage(result, "Provide only one of shareId or vaultName.");
  });

  it("rejects when itemId AND itemTitle are both set", () => {
    const result = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      itemTitle: "T",
    });
    expectIssueWithMessage(result, "Provide exactly one of itemId or itemTitle.");
  });

  it("rejects when neither itemId nor itemTitle are set", () => {
    const result = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
    });
    expectIssueWithMessage(result, "Provide exactly one of itemId or itemTitle.");
  });

  it("rejects shareId over 100 chars", () => {
    const result = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: STR_101,
      itemId: "i",
    });
    expect(result.success).toBe(false);
  });

  it("rejects vaultName over 255 chars", () => {
    const result = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      vaultName: STR_256,
      itemId: "i",
    });
    expect(result.success).toBe(false);
  });

  it("accepts confirm true/false/undefined", () => {
    const a = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      confirm: true,
    });
    const b = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
      confirm: false,
    });
    const c = untrashItemInputSchema.safeParse({
      agentReason: "Testing current CLI write contract",
      shareId: "s",
      itemId: "i",
    });
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(c.success).toBe(true);
  });

  it("type-inference smoke: literal assignable to UntrashItemInput", () => {
    const value: UntrashItemInput = { vaultName: "v", itemTitle: "T" };
    expect(value.vaultName).toBe("v");
  });
});

describe("downloadItemAttachmentInputSchema", () => {
  it("accepts a valid input", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
      attachmentId: "a",
      outputPath: "/tmp/out.bin",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing shareId", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      itemId: "i",
      attachmentId: "a",
      outputPath: "/tmp/out.bin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing itemId", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      shareId: "s",
      attachmentId: "a",
      outputPath: "/tmp/out.bin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing attachmentId", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
      outputPath: "/tmp/out.bin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing outputPath", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
      attachmentId: "a",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty outputPath (min 1)", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
      attachmentId: "a",
      outputPath: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts outputPath at exactly 4096 chars", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
      attachmentId: "a",
      outputPath: STR_4096,
    });
    expect(result.success).toBe(true);
  });

  it("rejects outputPath over 4096 chars", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
      attachmentId: "a",
      outputPath: STR_4097,
    });
    expect(result.success).toBe(false);
  });

  it("rejects shareId over 100 chars", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      shareId: STR_101,
      itemId: "i",
      attachmentId: "a",
      outputPath: "/tmp/out.bin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects itemId over 100 chars", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      shareId: "s",
      itemId: STR_101,
      attachmentId: "a",
      outputPath: "/tmp/out.bin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects attachmentId over 100 chars", () => {
    const result = downloadItemAttachmentInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
      attachmentId: STR_101,
      outputPath: "/tmp/out.bin",
    });
    expect(result.success).toBe(false);
  });

  it("type-inference smoke: literal assignable to DownloadItemAttachmentInput", () => {
    const value: DownloadItemAttachmentInput = {
      shareId: "s",
      itemId: "i",
      attachmentId: "a",
      outputPath: "/tmp/out.bin",
    };
    expect(value.outputPath).toBe("/tmp/out.bin");
  });
});

describe("deleteItemInputSchema", () => {
  it("accepts a valid input with confirm true", () => {
    const result = deleteItemInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
      confirm: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts confirm false", () => {
    const result = deleteItemInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
      confirm: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts confirm omitted (optional)", () => {
    const result = deleteItemInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing shareId", () => {
    const result = deleteItemInputSchema.safeParse({
      itemId: "i",
      confirm: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing itemId", () => {
    const result = deleteItemInputSchema.safeParse({
      shareId: "s",
      confirm: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts shareId at exactly 100 chars", () => {
    const result = deleteItemInputSchema.safeParse({
      shareId: STR_100,
      itemId: "i",
    });
    expect(result.success).toBe(true);
  });

  it("rejects shareId over 100 chars", () => {
    const result = deleteItemInputSchema.safeParse({
      shareId: STR_101,
      itemId: "i",
    });
    expect(result.success).toBe(false);
  });

  it("accepts itemId at exactly 100 chars", () => {
    const result = deleteItemInputSchema.safeParse({
      shareId: "s",
      itemId: STR_100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects itemId over 100 chars", () => {
    const result = deleteItemInputSchema.safeParse({
      shareId: "s",
      itemId: STR_101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confirm with non-boolean value", () => {
    const result = deleteItemInputSchema.safeParse({
      shareId: "s",
      itemId: "i",
      confirm: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("type-inference smoke: literal assignable to DeleteItemInput", () => {
    const value: DeleteItemInput = { shareId: "s", itemId: "i", confirm: true };
    expect(value.shareId).toBe("s");
  });
});

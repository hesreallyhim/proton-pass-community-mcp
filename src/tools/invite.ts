import { z } from "zod";

import { asJsonTextOrRaw, asTextContent, asWriteResult } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { asRecord, firstString } from "./shared/item-utils.js";
import { extractArrayFromParsed, paginateRefs } from "./shared/pagination.js";
import { confirmInput } from "./shared/schema-fragments.js";
import { requireWriteGate } from "./shared/write-gate.js";

const DEFAULT_INVITE_PAGE_SIZE = 100;
const MAX_INVITE_PAGE_SIZE = 250;

const PAGE_SIZE_DESCRIPTION = "Number of invites per page (1-250, default 100)";
const CURSOR_DESCRIPTION = "Pagination cursor from a previous response's nextCursor";

export type InviteRef = {
  id: string;
  type: string | null;
  target_name: string | null;
  inviter: string | null;
  role: string | null;
  state: string | null;
  create_time: string | null;
};

function toInviteRef(rawInvite: unknown, index: number): InviteRef {
  const invite = asRecord(rawInvite);
  if (!invite) {
    const fallbackId = `invite-${index + 1}`;
    return {
      id: fallbackId,
      type: null,
      target_name: null,
      inviter: null,
      role: null,
      state: null,
      create_time: null,
    };
  }

  const id = firstString(invite, ["invite_id", "invitation_id", "id"]) ?? `invite-${index + 1}`;

  return {
    id,
    type: firstString(invite, ["invite_type", "type", "share_type"]),
    target_name: firstString(invite, [
      "target_name",
      "resource_name",
      "name",
      "item_title",
      "vault_name",
      "title",
    ]),
    inviter: firstString(invite, ["inviter_email", "inviter", "from"]),
    role: firstString(invite, ["role", "share_role"]),
    state: firstString(invite, ["state", "status"]),
    create_time: firstString(invite, ["create_time", "created_at", "invite_time"]),
  };
}

export const listInvitesInputSchema = z
  .object({
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(MAX_INVITE_PAGE_SIZE)
      .optional()
      .describe(PAGE_SIZE_DESCRIPTION),
    cursor: z.string().max(20).optional().describe(CURSOR_DESCRIPTION),
  })
  .default({});

const inviteTokenInput = z.string().min(1).max(4096).describe("Invitation token");

export const inviteAcceptInputSchema = z.object({
  inviteToken: inviteTokenInput,
  confirm: confirmInput,
});

export const inviteRejectInputSchema = z.object({
  inviteToken: inviteTokenInput,
  confirm: confirmInput,
});

export type ListInvitesInput = z.infer<typeof listInvitesInputSchema>;
export type InviteAcceptInput = z.infer<typeof inviteAcceptInputSchema>;
export type InviteRejectInput = z.infer<typeof inviteRejectInputSchema>;

export async function listInvitesHandler(
  passCli: PassCliRunner,
  { pageSize, cursor }: ListInvitesInput = {},
) {
  const { stdout } = await passCli(["invite", "list", "--output", "json"]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  const rawInvites = extractArrayFromParsed(parsed, ["invites", "invitations", "items", "results"]);
  if (!rawInvites) {
    return asTextContent(asJsonTextOrRaw(stdout));
  }
  const refs = rawInvites.map((invite, index) => toInviteRef(invite, index));
  const page = paginateRefs(refs, cursor, pageSize, DEFAULT_INVITE_PAGE_SIZE);

  const structuredContent = {
    ...page,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export async function inviteAcceptHandler(
  passCli: PassCliRunner,
  { inviteToken, confirm }: InviteAcceptInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli(["invite", "accept", "--invite-token", inviteToken]);
  return asWriteResult(stdout, stderr);
}

export async function inviteRejectHandler(
  passCli: PassCliRunner,
  { inviteToken, confirm }: InviteRejectInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli(["invite", "reject", "--invite-token", inviteToken]);
  return asWriteResult(stdout, stderr);
}

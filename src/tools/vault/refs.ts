import { asRecord, firstString } from "../shared/item-utils.js";

export type VaultMemberRef = {
  id: string;
  username: string | null;
  email: string | null;
  role: string | null;
  state: string | null;
  create_time: string | null;
};

export function toVaultMemberRef(rawMember: unknown, index: number): VaultMemberRef {
  const member = asRecord(rawMember);
  if (!member) {
    const fallbackId = `member-${index + 1}`;
    return {
      id: fallbackId,
      username: null,
      email: null,
      role: null,
      state: null,
      create_time: null,
    };
  }

  const id =
    firstString(member, ["member_share_id", "member_id", "id", "share_id", "user_id"]) ??
    `member-${index + 1}`;

  return {
    id,
    username: firstString(member, ["username", "member_name", "name", "display_name"]),
    email: firstString(member, ["email", "member_email", "user_email"]),
    role: firstString(member, ["role", "share_role"]),
    state: firstString(member, ["state", "status"]),
    create_time: firstString(member, ["create_time", "created_at", "invite_time"]),
  };
}

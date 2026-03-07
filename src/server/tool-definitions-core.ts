import type { PassCliRunner } from "../pass-cli/runner.js";
import type { PassCliVersionPolicy } from "../pass-cli/version.js";
import { checkStatusHandler } from "../tools/check-status.js";
import { injectHandler, injectInputSchema, runHandler, runInputSchema } from "../tools/contents.js";
import {
  inviteAcceptHandler,
  inviteAcceptInputSchema,
  inviteRejectHandler,
  inviteRejectInputSchema,
  listInvitesHandler,
  listInvitesInputSchema,
} from "../tools/invite.js";
import {
  generatePassphraseHandler,
  generatePassphraseInputSchema,
  generateRandomPasswordHandler,
  generateRandomPasswordInputSchema,
  scorePasswordHandler,
  scorePasswordInputSchema,
} from "../tools/password.js";
import {
  viewSessionInfoHandler,
  viewUserInfoHandler,
  viewUserInfoInputSchema,
} from "../tools/session.js";
import {
  settingsSetDefaultVaultHandler,
  settingsSetDefaultVaultInputSchema,
  settingsUnsetDefaultVaultHandler,
  settingsUnsetDefaultVaultInputSchema,
  viewSettingsHandler,
} from "../tools/settings.js";
import { listSharesHandler, listSharesInputSchema } from "../tools/share.js";
import { supportHandler } from "../tools/support.js";
import { generateTotpHandler, generateTotpInputSchema } from "../tools/totp.js";
import {
  createVaultHandler,
  createVaultInputSchema,
  deleteVaultHandler,
  deleteVaultInputSchema,
  listVaultMembersHandler,
  listVaultMembersInputSchema,
  listVaultsHandler,
  listVaultsInputSchema,
  removeVaultMemberHandler,
  removeVaultMemberInputSchema,
  shareVaultHandler,
  shareVaultInputSchema,
  transferVaultHandler,
  transferVaultInputSchema,
  updateVaultHandler,
  updateVaultInputSchema,
  updateVaultMemberHandler,
  updateVaultMemberInputSchema,
} from "../tools/vault.js";
import { inputTool, noInputTool, type ToolDefinition } from "./tool-definition-types.js";

export function createCoreToolDefinitions(
  passCli: PassCliRunner,
  versionPolicy: PassCliVersionPolicy = {},
): ToolDefinition[] {
  return [
    noInputTool(
      "view_session_info",
      "View current Proton Pass session/account summary from pass-cli info.",
      () => viewSessionInfoHandler(passCli),
    ),
    noInputTool(
      "check_status",
      "Run preflight checks for connectivity/authentication and CLI version compatibility.",
      () => checkStatusHandler(passCli, versionPolicy),
      false,
    ),
    noInputTool("support", "Display Proton Pass CLI support guidance text.", () =>
      supportHandler(passCli),
    ),
    inputTool(
      "inject",
      "Inject secrets from Proton Pass references into a template file.",
      injectInputSchema,
      (input) => injectHandler(passCli, input),
    ),
    inputTool(
      "run",
      "Run a command with Proton Pass secret references resolved in environment.",
      runInputSchema,
      (input) => runHandler(passCli, input),
    ),
    inputTool(
      "view_user_info",
      "View Proton user profile/account details from pass-cli user info.",
      viewUserInfoInputSchema,
      (input) => viewUserInfoHandler(passCli, input),
    ),
    inputTool(
      "list_vaults",
      "List vaults accessible to the current authenticated user.",
      listVaultsInputSchema,
      (input) => listVaultsHandler(passCli, input),
    ),
    inputTool("create_vault", "Create a new vault.", createVaultInputSchema, (input) =>
      createVaultHandler(passCli, input),
    ),
    inputTool(
      "update_vault",
      "Update a vault by share ID or vault name.",
      updateVaultInputSchema,
      (input) => updateVaultHandler(passCli, input),
    ),
    inputTool("share_vault", "Share a vault with a user.", shareVaultInputSchema, (input) =>
      shareVaultHandler(passCli, input),
    ),
    inputTool(
      "transfer_vault",
      "Transfer vault ownership to a member.",
      transferVaultInputSchema,
      (input) => transferVaultHandler(passCli, input),
    ),
    inputTool(
      "delete_vault",
      "Delete a vault by share ID or vault name.",
      deleteVaultInputSchema,
      (input) => deleteVaultHandler(passCli, input),
    ),
    inputTool(
      "list_shares",
      "List shares accessible to the current authenticated user.",
      listSharesInputSchema,
      (input) => listSharesHandler(passCli, input),
    ),
    inputTool(
      "list_invites",
      "List pending invitations accessible to the current authenticated user.",
      listInvitesInputSchema,
      (input) => listInvitesHandler(passCli, input),
    ),
    inputTool("accept_invite", "Accept an invitation token.", inviteAcceptInputSchema, (input) =>
      inviteAcceptHandler(passCli, input),
    ),
    inputTool("reject_invite", "Reject an invitation token.", inviteRejectInputSchema, (input) =>
      inviteRejectHandler(passCli, input),
    ),
    noInputTool("view_settings", "View current Proton Pass CLI settings.", () =>
      viewSettingsHandler(passCli),
    ),
    inputTool(
      "set_default_vault",
      "Set default vault by share ID or vault name.",
      settingsSetDefaultVaultInputSchema,
      (input) => settingsSetDefaultVaultHandler(passCli, input),
    ),
    inputTool(
      "unset_default_vault",
      "Unset default vault setting.",
      settingsUnsetDefaultVaultInputSchema,
      (input) => settingsUnsetDefaultVaultHandler(passCli, input),
    ),
    inputTool(
      "generate_random_password",
      "Generate a random password.",
      generateRandomPasswordInputSchema,
      (input) => generateRandomPasswordHandler(passCli, input),
    ),
    inputTool(
      "generate_passphrase",
      "Generate a passphrase.",
      generatePassphraseInputSchema,
      (input) => generatePassphraseHandler(passCli, input),
    ),
    inputTool("score_password", "Score password strength.", scorePasswordInputSchema, (input) =>
      scorePasswordHandler(passCli, input),
    ),
    inputTool(
      "generate_totp",
      "Generate a TOTP token from a secret or otpauth URI.",
      generateTotpInputSchema,
      (input) => generateTotpHandler(passCli, input),
    ),
    inputTool(
      "list_vault_members",
      "List members for a vault by share ID or vault name.",
      listVaultMembersInputSchema,
      (input) => listVaultMembersHandler(passCli, input),
    ),
    inputTool(
      "update_vault_member",
      "Update a vault member role.",
      updateVaultMemberInputSchema,
      (input) => updateVaultMemberHandler(passCli, input),
    ),
    inputTool(
      "remove_vault_member",
      "Remove a member from a vault.",
      removeVaultMemberInputSchema,
      (input) => removeVaultMemberHandler(passCli, input),
    ),
  ];
}

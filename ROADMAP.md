# Roadmap

This project is intentionally small, so the roadmap focuses on high-leverage additions with clear utility.

## Completed Milestones

- [x] Dedicated password tooling shipped:
  - `generate_random_password`
  - `generate_passphrase`
  - `score_password`
- [x] Immediate-utility wrappers shipped:
  - `generate_totp`
  - `list_invites`, `accept_invite`, `reject_invite`
  - `list_shares`
  - `trash_item`, `untrash_item`
- [x] Filtered listing support shipped in `list_items`:
  - `filterType`, `filterState`, `sortBy`
- [x] Operational tooling shipped:
  - `download_item_attachment`
  - `move_item`
  - vault/item member management tools
- [x] Stage A npm distribution prep shipped:
  - package metadata for npm/provenance
  - release workflow that validates/packages and uploads tarball/checksum
  - publish path is configured for direct trusted publishing on stable releases

## Top Priority Next

1. Complete npm trusted publishing cutover.

- Configure npm trusted publisher for this repo/workflow/environment.
- Cut next release and verify npm publish + provenance.

2. Add MCP resources for read-heavy workflows.

- Candidate resources:
  - `pass://vaults`
  - `pass://vault/{vaultName}/items`
  - `pass://share/{shareId}/items`
  - `pass://item/{shareId}/{itemId}`
- Why:
  - Better for browse/read usage, caching, and context injection into LLM prompts.

## Mid-Term (Workflow Features)

1. Prompt templates for common secure operations.

- Rotate login password
- Share item with role and confirm recipient
- Move item between vaults with verification

2. Safer write modes.

- Optional dry-run planning for write tools
- Standardized confirmation payload (operation + target summary)

## Proton Mail Automation (Reality Check)

There does not appear to be a comparable public, user-facing Proton Mail CLI for full mailbox administration comparable to `pass-cli` for Proton Pass.

Most practical official automation-adjacent options today:

- Proton Mail Bridge CLI mode (for local IMAP/SMTP integration)
- Proton Mail Export Tool CLI mode (backup/restore workflows)
- Easy Switch (web-managed import automation from external providers)

This is useful for mailbox pipeline workflows, but it is not the same as a direct public "manage mailbox via official API" model.

## Open Questions

1. MCP scope across Proton offerings.

- The ProtonPass GitHub organization includes Proton Pass and Proton Authenticator repositories, with overlap around TOTP workflows.
- Decide whether this MCP remains strictly Proton Pass (`pass-cli`) or intentionally expands to include Proton Authenticator-related capabilities.
- Define whether TOTP features in this MCP should be treated as Pass-only scope or cross-offering scope.

## References

- Proton Bridge CLI:
  - <https://proton.me/support/bridge-cli-guide>
- Proton Mail export/import options:
  - <https://proton.me/support/export-import-emails>
  - <https://proton.me/support/proton-mail-export-tool>

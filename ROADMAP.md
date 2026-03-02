# Roadmap

This project is intentionally small, so the roadmap focuses on high-leverage additions with clear utility.

## Top Priority Next (Post-0.1 / Early 0.2)

1. Ship dedicated `password` tooling as a high-value track.

- Commands:
  - `pass-cli password generate random`
  - `pass-cli password generate passphrase`
  - `pass-cli password score`
- Rationale:
  - These commands are useful even without Proton authentication.
  - They provide immediate standalone value for secure credential hygiene.
- Product direction:
  - Include this in `0.2` planning immediately after `0.1`.
  - Evaluate packaging as both MCP tools and a standalone skill profile.

## Near-Term (Practical Additions)

1. Add `pass-cli` wrappers with immediate utility.

- `password generate` (`pass-cli password generate`)
- `password score` (`pass-cli password score`)
- `totp generate` (`pass-cli totp generate`)
- `invite list/accept/reject`
- `share list` [USER: INCLUDED IN V0.1]
- `item trash/untrash`

2. Add MCP resources for read-heavy workflows.

- Resource ideas:
  - `pass://vaults`
  - `pass://vault/{vaultName}/items`
  - `pass://share/{shareId}/items`
  - `pass://item/{shareId}/{itemId}`

Why: resources are better than tools for browse/read usage, caching, and context injection into LLM prompts.

3. Add filtered list support to `pass_item_list`.

- `filterType`, `filterState`, `sortBy` (supported by `pass-cli item list`)

## Mid-Term (Workflow Features)

1. Prompt templates for common secure operations.

- Rotate login password
- Share item with role and confirm recipient
- Move item between vaults with verification

2. Safer write modes.

- Optional dry-run planning for write tools
- Standardized confirmation payload (operation + target summary)

3. More operational tooling.

- `item attachment download`
- `item move`
- vault/item member management wrappers

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

# Roadmap

This project is intentionally small, so the roadmap focuses on high-leverage additions with clear utility.

## Near-Term (Practical Additions)

1. Add `pass-cli` wrappers with immediate utility.

- `password generate` (`pass-cli password generate`)
- `password score` (`pass-cli password score`)
- `totp generate` (`pass-cli totp generate`)
- `invite list/accept/reject`
- `share list`
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

## GitHub Credential Management (Research Notes)

Goal: reduce friction for rotating GitHub credentials/tokens.

### What appears possible now

1. PAT creation/rotation is still UI-centric for user tokens.

- GitHub docs for managing personal access tokens describe UI flows.
- You can pre-fill token-creation forms with URL query parameters, but this is still web UI-based.

2. `gh` CLI does not expose PAT create/rotate commands.

- `gh auth` supports login/status/refresh/token, but not PAT lifecycle creation APIs.

3. Organization-level token governance APIs exist, but they are not personal PAT self-service creation APIs.

- Examples include fine-grained PAT request management APIs for org governance.

### Practical alternatives worth exploring

1. Prefer GitHub Apps for automation where possible.

- Installation access tokens are short-lived (hour-scale) and mintable via API.
- This gives the "short-lived credential" behavior people often want from PAT rotation.

2. Use repo/org secret automation to reduce rotation pain.

- Keep generated credentials in a secret manager (for example Proton Pass).
- Script propagation to GitHub with `gh secret set` so changing tokens is one command, not many manual updates.

3. Keep PAT usage narrow.

- Use fine-grained PATs with shortest practical expiry and minimum scopes.
- Use prefilled token creation URLs to reduce UI friction when PATs are required.

4. Automate distribution, not token minting.

- Use `gh secret set` to push rotated credentials across repos/environments.
- This removes most manual touch points even when PAT creation remains UI-driven.

## Proton Mail Automation (Reality Check)

There does not appear to be a comparable public, user-facing Proton Mail CLI for full mailbox administration comparable to `pass-cli` for Proton Pass.

Most practical official automation-adjacent options today:

- Proton Mail Bridge CLI mode (for local IMAP/SMTP integration)
- Proton Mail Export Tool CLI mode (backup/restore workflows)
- Easy Switch (web-managed import automation from external providers)

This is useful for mailbox pipeline workflows, but it is not the same as a direct public "manage mailbox via official API" model.

## References

- GitHub PAT management:
  - <https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token>
- PAT prefilled URL parameters:
  - <https://docs.github.com/en/enterprise-server%403.14/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens>
- GitHub App installation token auth:
  - <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation>
- Installation-token endpoint support matrix:
  - <https://docs.github.com/en/rest/authentication/endpoints-available-for-github-app-installation-access-tokens>
- Org PAT governance endpoints:
  - <https://docs.github.com/en/rest/orgs/personal-access-tokens>
- Proton Bridge CLI:
  - <https://proton.me/support/bridge-cli-guide>
- Proton Mail export/import options:
  - <https://proton.me/support/export-import-emails>
  - <https://proton.me/support/proton-mail-export-tool>

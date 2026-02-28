# GitHub App Installation Token Limitations (vs PAT)

This note documents where GitHub App installation tokens are strong, and where they are not a full replacement for personal access tokens (PATs).

## TL;DR

- For repository/org automation, installation tokens are usually the best default.
- For user-scoped operations and user identity APIs, PATs (or GitHub App user tokens) still have a gap.
- PAT creation/rotation itself remains UI-centric for personal tokens.

## Token Types in Scope

| Token Type             | Identity            | Typical Lifetime      | Best For                                    |
| ---------------------- | ------------------- | --------------------- | ------------------------------------------- |
| Fine-grained PAT       | User                | User-defined expiry   | User-scoped API and ad hoc CLI use          |
| App installation token | App installation    | 1 hour                | Automation on installed repos/org resources |
| App user access token  | User via GitHub App | Short-lived + refresh | User-context flows through an app           |

## What Installation Tokens Cannot Do (Commonly)

1. Act as a general user token across all user-owned resources.

- Installation tokens are scoped to the app installation and its granted permissions.
- They cannot implicitly access repositories where the app is not installed.

2. Replace user-auth endpoints that require user-context token types.

- Many user endpoints document supported token types explicitly.
- Example: `GET /user` supports GitHub App **user** access tokens and fine-grained PATs, not installation tokens.

3. Solve PAT lifecycle UX directly.

- GitHub’s PAT documentation remains centered on web UI creation/management.
- `gh auth` does not provide a PAT create/rotate command surface.

4. Bypass app permission boundaries.

- Installation tokens are constrained by app permission grants plus installation scope.
- If the app lacks a permission, the token cannot do that operation.

## Where Installation Tokens Are Better Than PATs

1. Short-lived credentials by default (lower standing credential risk).
2. Narrow, explicit permission model at app level.
3. Better automation ergonomics for CI/bots than long-lived user tokens.

## PAT vs App Decision Guide

Use installation tokens when:

- operations are repo/org automation tasks
- you can install an app on all target repositories
- short-lived token issuance is desired

Use fine-grained PATs when:

- you need direct user-context operations not covered by installation tokens
- you need access patterns tied to user account capabilities
- GitHub App adoption is not yet feasible for the workflow

Use App user tokens when:

- you want app-centric architecture but still need user identity context

## Practical Hybrid Pattern

1. Default to GitHub App installation tokens for automation.
2. Keep PAT use as an exception path for user-scoped gaps.
3. Automate secret propagation (`gh secret set`) so PAT rotations are low-friction.
4. Keep PAT expiry short where possible, with scripted rollout.

## References

- Installation token auth:
  - <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation>
- Installation-token endpoint matrix:
  - <https://docs.github.com/en/rest/authentication/endpoints-available-for-github-app-installation-access-tokens>
- Example endpoint token type support (`GET /user`):
  - <https://docs.github.com/en/rest/users/users#get-the-authenticated-user>
- PAT docs:
  - <https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token>
  - <https://docs.github.com/en/enterprise-server%403.14/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens>
- GitHub App user token refresh:
  - <https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens>
- GitHub CLI manual:
  - <https://cli.github.com/manual/gh_auth>
  - <https://cli.github.com/manual/gh_secret_set>

# Security Policy

## Reporting a Vulnerability

Please do not open public issues for suspected security vulnerabilities.

Instead:

- [Open a private GitHub security advisory for this repository](https://github.com/hesreallyhim/proton-pass-community-mcp/security/advisories/new).
- See GitHub's [private vulnerability reporting guide](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) if you are unfamiliar with the flow.

Security concerns will be treated with urgency due to the sensitive nature of the library.

An initial response may be expected within 7 days. 

## Report Expectations

Include:

1. A clear description of the issue and impact.
2. Reproduction steps or proof of concept.
3. Affected versions/commits.
4. Suggested mitigation if available.

## Scope Notes

1. `proton-pass-community-mcp` is an MCP wrapper around `pass-cli`; vulnerabilities in upstream Proton services/clients should also be reported to Proton through their official channels.
2. Do not include real credentials, vault contents, OTP values, or private keys in reports.

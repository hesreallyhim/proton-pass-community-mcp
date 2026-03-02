---
name: skill-wrapper-protocol
description: Canonical protocol for model-side skill behavior when orchestrating proton-pass-community-mcp tools in chat sessions.
---

# Proton Pass MCP Skill Wrapper

Use this skill as a thin protocol layer around the `proton-pass-community-mcp` MCP server.

## Purpose

1. Enforce authentication-safe behavior for model-driven tool usage.
2. Run a fast preflight before normal tool workflows.
3. Keep secret material out of chat and tool arguments unless explicitly required by a user-approved tool.

## Session Startup Protocol

Run this flow once when the skill is loaded for a new chat session:

1. Call `check_status`.
2. If it succeeds, proceed with requested tools.
3. If it returns `AUTH_REQUIRED` or `AUTH_EXPIRED`:
   - Tell the user to run `pass-cli login` outside MCP.
   - Tell the user to confirm when login is complete.
   - Retry `check_status` once user confirms.
4. If it returns a CLI version compatibility error:
   - Tell the user the detected version and pinned requirement.
   - Ask the user to update/downgrade `pass-cli` outside MCP before continuing.

Do not run `check_status` before every subsequent tool call in the same session.
Only run it again if an `AUTH_*` error occurs and the user says they re-authenticated.

## Authentication Safety Rules

1. Never ask the user to paste passwords, OTP codes, private keys, or session tokens into chat.
2. Never attempt to discover credentials from local files, environment variables, browser state, or third-party services.
3. Treat authentication as user-managed out-of-band.
4. If auth errors persist after user confirmation, report failure and stop.

## Tool Usage Guidance

1. Prefer list/search tools first, then targeted view/read tools.
2. Keep outputs minimal and deterministic when possible.
3. For mutative operations, follow MCP write gates and explicit confirmation requirements.

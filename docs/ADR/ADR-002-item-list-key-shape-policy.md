# ADR-002: `item list` Key Shape Policy

Status: Accepted  
Date: 2026-03-02

`pass-cli item list --output json` key shape is not fully documented upstream, so we must choose a stable interpretation and record it. Decision: parse snake_case item-list keys as the canonical shape (for example `id`, `share_id`, `vault_id`, `create_time`, `modify_time`) and remove camelCase fallbacks from normalization logic. If upstream output changes, we will update parsing with an explicit ADR/test update rather than silently widening key-guessing behavior.

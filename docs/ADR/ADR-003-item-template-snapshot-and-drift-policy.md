# ADR-003: Item Template Snapshot and Drift Policy

Status: Accepted  
Date: 2026-03-06

During throwaway-account validation, we confirmed `pass-cli item create <type> --get-template` and `--from-template` support for multiple item types (`login`, `note`, `credit-card`, `wifi`, `custom`, `identity`), while upstream docs remain login-centric for explicit template schema examples. Decision: record a committed template snapshot artifact and expose it as MCP resources (`pass://templates/item-create` and `pass://templates/item-create/<type>`) for testing/discovery, and add a weekly CI drift check against the snapshot to detect upstream CLI contract changes. We intentionally defer expanding non-login template create tools until we finalize the MCP creation-tool strategy and per-type schema design.

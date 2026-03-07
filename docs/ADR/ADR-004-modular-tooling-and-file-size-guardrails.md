# ADR-004: Modular Tooling and File Size Guardrails

Status: Accepted  
Date: 2026-03-07

Refactoring analysis and complexity reporting surfaced a maintainability risk: large multi-responsibility modules (notably `src/tools/item.ts` and `src/tools/vault.ts`) were raising navigation cost, merge conflict risk, and implementation coupling. Decision: adopt explicit decomposition and composition rules for tool modules: split schemas / handlers / shared helpers into focused files, preserve public API surfaces through barrel exports, and centralize repeated logic (pagination, scope handling, write-output shaping) to improve DRYness. We also adopt file-size guardrails for `src/**/*.ts`: hard ceiling `500` lines, target `<=250` lines, with compose-method / SOLID-oriented extraction when approaching limits. This refactor reduced the maximum source file size to below the target threshold while preserving existing tool behavior and test compatibility.

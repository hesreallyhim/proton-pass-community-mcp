# Changelog

## [1.0.1](https://github.com/hesreallyhim/proton-pass-community-mcp/compare/v1.0.0...v1.0.1) (2026-03-09)


### Bug Fixes

* don't invoke output flag when not allowed ([a0413d9](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/a0413d9f4761a9339b72bd92da3c7cd91d82a2fc))
* **item:** remove output param from login create schemas ([6dc91d1](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/6dc91d14a6eca3d2c0777c233f4bbdb4c5ee2784))
* **pass-cli:** normalize output arg policy in runner ([7c73739](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/7c73739b8c096c604e7a172859283e5b5dc4907d))

## [1.0.0](https://github.com/hesreallyhim/proton-pass-community-mcp/compare/v0.3.0...v1.0.0) (2026-03-08)


### ⚠ BREAKING CHANGES

* remove support tool from mcp surface
* remove default-format MCP tools
* rename template tool to login-only contract
* normalize MCP tool names to verb-first ordering

### Features

* add inject and run tools ([d0b565e](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/d0b565eccd9d86a8c26f8c7e1ec156683a5cca9e))
* add invite_accept and invite_reject tools ([11eabfa](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/11eabfa9da37660bd820f5bc4ac527d687dec9cf))
* add item attachment and member tools ([d8b92da](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/d8b92dac5a533899f034aa564e2b7d6979e49d17))
* add item_totp tool with selector and uri modes ([6bfe4a3](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/6bfe4a3d90b419c835e3001c1825c1673186a6b5))
* add item-create template resources and snapshot ([2cfe889](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/2cfe889e7a9b0ef9b3208b0a1776b884a7d557f5))
* add item-template probe runner and report ([2950f2d](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/2950f2d9cd0d727b7633bbb9aac272aa5d39cb87))
* add move, trash, and untrash item tools ([1db347b](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/1db347babb2e8f71ad8c69e19567700261836390))
* add password utility tools ([c0a51d4](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/c0a51d4d5b3e70ea305c88bb42b38d1273cca27b))
* add per-type item creation tools ([0ea7072](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/0ea70723139fa8f858a0bbe1334d7889f188cd39))
* add settings default set/unset tools ([8463dea](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/8463deae4db07cbf7596c7c5f55f3a7d7e7cd8ea))
* add support and totp generation tools ([a02b9ba](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/a02b9bab102fb46d4b54e93bb4d715e64aeaf9ec))
* add vault member update and remove tools ([9b74964](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/9b749644bf6c250dd34a7bf7fd1509ddc6efc89b))
* add vault_share and item_share tools ([3ae1a7d](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/3ae1a7de4835da0cfe2919939c7d64f74eb18859))
* add vault_transfer and create_item_alias tools ([3d1766c](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/3d1766c862bb89fc5a426255675da28e7515cf4f))
* complexity analyzer ([e56dc7c](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/e56dc7c5fcd0e4c4040041eebe5e882b85aaf6b0))
* **dev:** add anonymized docker demo shell ([c0e62e8](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/c0e62e84c73eb6f92e95f906e0932bc4a5a34a82))
* expose update_vault and create_item_from_template tools ([0a64296](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/0a64296bdeda4f3e08b17732ae58b494311e9137))
* probe template additional-properties behavior ([7becc88](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/7becc88b73cbef991f143f901a08201313d5ee1d))
* remove support tool from mcp surface ([0a065d9](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/0a065d9edc58db5155c909de91baed8b9ba36472))


### Code Refactoring

* normalize MCP tool names to verb-first ordering ([fdc2165](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/fdc21650d59868328bf2399a4fea0fea652eb9ac))
* remove default-format MCP tools ([9e56e9b](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/9e56e9bd25b675ba9ce97d9f33f47fb64e99ac5e))
* rename template tool to login-only contract ([be42a9b](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/be42a9b3f1ccf1ee7b3badbc3766116d24a3513e))

## [0.3.0](https://github.com/hesreallyhim/proton-pass-community-mcp/compare/v0.2.0...v0.3.0) (2026-03-07)


### Features

* register CRUD loop tools for vault and item flows ([6761a04](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/6761a046b008451744de90d2a3a6ac0ad4f4b238))


### Bug Fixes

* make preflight account compare bash-3 compatible ([9864b5c](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/9864b5c54ae5bbbeee9b1a24c2dd5e087e9957ab))

## [0.2.0](https://github.com/hesreallyhim/proton-pass-community-mcp/compare/v0.1.0...v0.2.0) (2026-03-06)


### Features

* **read-tools:** add invites settings and vault member read surface ([1856e56](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/1856e56337dc33ec4ed5a320bcd37990edf60efb))

## 0.1.0 (2026-03-02)


### Features

* add initial files ([e49d670](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/e49d670a2a3a73ca88bdb42d7850804e6f05989b))
* add title-based search_items tool ([3c34889](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/3c34889bb1f0f7554e7a74bde1506481ff009418))
* add tool descriptions ([f868e46](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/f868e466b7f8fe751375be00240e36ee95110943))
* add Zod .describe() and .max() constraints to all tool schemas ([5afd200](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/5afd2001e75cf519a2f990f88f7ac27a8afc79cc))
* **api:** adopt natural tool names and add view_user_info ([463b41e](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/463b41e759fdfa8477e5ed2f6ed1535c02fdc53e))
* **auth:** standardize pass-cli auth error contract ([3fce77b](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/3fce77b9d9213006079a3a9487db1ab77e56c170))
* enforce reference-only list_items contract ([78d6944](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/78d6944b9edd49cf2fc7851a6760bcb7a8246bb0))
* **preflight:** add check_status and consolidate upstream docs ([f1de5f9](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/f1de5f9c92e937fe575a9cb81390444997ae6c88))
* **read:** add pass_test preflight and skill protocol ([b8c2972](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/b8c29728bbb3bcd9facf0737f6a896fbfef0f4f6))
* register list_shares tool ([6d27f71](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/6d27f716060ff67a202446cdf6a08e8d611805a6))
* restrict default tool registration to v0.1 scope ([47a996f](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/47a996f853f8b031e14adae1b7f4e1298cfd9a3e))
* tighten item list schema and derive item type refs ([fa793e7](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/fa793e70251712e4b41f060223a26713447b6740))


### Bug Fixes

* add node shebang for packaged CLI bin ([b7112b9](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/b7112b9766f7de8c3f290c6110185cd43279d510))
* **mcp:** paginate item list and align vault list output handling ([eec91f1](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/eec91f16a1a6963da6ddaad9169de57e9fea3a82))
* prepare package.json for npm publishing ([86b5da8](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/86b5da82e2c852e0eb9b6de2f712a3a0dc299b45))
* **security:** add -- separator before positional user-supplied args ([b52bfe3](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/b52bfe3e572c966896a3cc1dbd76e206a6e5163b))


### Documentation

* add comment about skill file ([432c6a3](https://github.com/hesreallyhim/proton-pass-community-mcp/commit/432c6a3eb05e001b770a128ab3d6f51129cd6288))

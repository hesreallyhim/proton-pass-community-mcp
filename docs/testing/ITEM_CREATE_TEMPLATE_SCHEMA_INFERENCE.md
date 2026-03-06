---
name: item-create-template-schema-inference
description: Inferred per-type `item create <type> --from-template` input contracts from snapshot + probe evidence.
---

# Item Create Template Schema Inference (pass-cli 1.5.2)

## Scope

This document captures **inferred** input schemas for:

- `pass-cli item create login --from-template`
- `pass-cli item create note --from-template`
- `pass-cli item create credit-card --from-template`
- `pass-cli item create wifi --from-template`
- `pass-cli item create custom --from-template`
- `pass-cli item create identity --from-template`

Version/source boundary:

- CLI version: `Proton Pass CLI 1.5.2 (41cf394)`
- Snapshot artifact: `docs/testing/item-create-templates.snapshot.json`
- Probe artifact: `docs/testing/item-create-template-probe.report.json`
- Additional-properties probe artifact: `docs/testing/item-create-template-additional-properties.report.json`
- Upstream docs pages:
  - `https://protonpass.github.io/pass-cli/commands/item/`
  - `https://protonpass.github.io/pass-cli/objects/item/`
- Last validated: March 6, 2026

Important: these are not authoritative upstream schemas. They are working contracts inferred from observed parser/validation behavior.

## Global Findings

1. `title` is required for all tested types.
2. `title: null` is rejected for all tested types.
3. `title: ""` is accepted by parser and create flow for `login`, `note`, `credit-card`, `custom`, and `identity`.
4. For `wifi`, creation fails with empty template defaults because `ssid` is empty (`Invalid SSID`, `SSID cannot be empty`).
5. Template payloads are examples of accepted shape, not guaranteed create-ready values.

Additional-properties findings (March 6, 2026):

6. Unknown top-level properties were accepted for all tested types (`login`, `note`, `credit-card`, `wifi`, `custom`, `identity`).
7. For `custom`, unknown nested properties in `sections[]` and `fields[]` were also accepted.
8. Accepted unknown properties are not evidence of persistence. Spot-check `item view --output json` indicates probe-only unknown keys are dropped/ignored rather than stored.

## Per-Type Inferred Schemas

Legend:

- `required`: directly proven by failing probe on omission
- `optional`: omission or nullability behavior observed
- `unknown`: not yet directly probed

### login

```yaml
type: object
required:
  - title
properties:
  title:
    type: string
    nullable: false
    empty_string_accepted: true
    status: required
  username:
    type: string
    nullable: true
    status: optional
  email:
    type: string
    nullable: true
    status: optional
  password:
    type: string
    nullable: true
    status: optional
  urls:
    type: array
    items:
      type: string
    nullable: false
    status: unknown
additionalProperties: unknown
```

Evidence:

1. `omit_title` and `title_null` fail.
2. Removing null template placeholders succeeds (`omit_all_null_fields`), so `username`/`email`/`password` are optional in template mode.
3. `urls` omission was not directly probed in this run.
4. Unknown top-level keys are accepted by parser/create flow but appear ignored on persisted item view.

### note

```yaml
type: object
required:
  - title
properties:
  title:
    type: string
    nullable: false
    empty_string_accepted: true
    status: required
  note:
    type: string
    nullable: true
    status: optional
additionalProperties: unknown
```

Evidence:

1. `omit_title` and `title_null` fail.
2. Template with `note` removed succeeds (`omit_all_null_fields`).
3. Unknown top-level keys are accepted by parser/create flow but appear ignored on persisted item view.

### credit-card

```yaml
type: object
required:
  - title
properties:
  title:
    type: string
    nullable: false
    empty_string_accepted: true
    status: required
  cardholder_name: { type: string, nullable: true, status: optional }
  card_type: { type: string, nullable: true, status: optional }
  number: { type: string, nullable: true, status: optional }
  cvv: { type: string, nullable: true, status: optional }
  expiration_date: { type: string, nullable: true, status: optional }
  pin: { type: string, nullable: true, status: optional }
  note: { type: string, nullable: true, status: optional }
additionalProperties: unknown
```

Evidence:

1. `omit_title` and `title_null` fail.
2. Removing all null placeholder fields succeeds (`omit_all_null_fields`), indicating optional template fields.
3. Prior manual check (same date/account) observed `expiration_date` format sensitivity (expected `YYYY-MM` when provided).
4. Unknown top-level keys are accepted by parser/create flow (persistence not separately verified for this type).

### wifi

```yaml
type: object
required:
  - title
  - ssid
properties:
  title:
    type: string
    nullable: false
    empty_string_accepted: true
    status: required
  ssid:
    type: string
    nullable: false
    empty_string_accepted: false
    status: required
  password:
    type: string
    nullable: unknown
    status: unknown
  security:
    type: string
    nullable: unknown
    status: unknown
  note:
    type: string
    nullable: unknown
    status: unknown
additionalProperties: unknown
```

Evidence:

1. Snapshot baseline (`ssid: ""`) fails create-time validation (`Invalid SSID`).
2. `omit_title` and `title_null` fail parser validation.
3. `nullify_string_fields` fails parser validation at first typed string field (`ssid` expected string, not null).
4. With a valid non-empty `ssid`, unknown top-level keys are accepted by parser/create flow (persistence not separately verified for this type).

### custom

```yaml
type: object
required:
  - title
properties:
  title:
    type: string
    nullable: false
    empty_string_accepted: true
    status: required
  note:
    type: string
    nullable: true
    status: optional
  sections:
    type: array
    status: unknown
    items:
      type: object
      required:
        - section_name
        - fields
      properties:
        section_name:
          type: string
        fields:
          type: array
          items:
            type: object
            required:
              - field_name
              - field_type
              - value
            properties:
              field_name: { type: string }
              field_type:
                type: string
                enum_examples: [text, hidden, totp, timestamp]
              value: { type: string }
additionalProperties: unknown
```

Evidence:

1. `omit_title` and `title_null` fail.
2. Top-level `note` can be `null` (`nullify_string_fields` success).
3. `sections` omission/shape strictness was not directly probed; nested structure is from `--get-template`.
4. Unknown top-level and nested keys (`sections[]` and `fields[]`) are accepted by parser/create flow but appear ignored on persisted item view.

### identity

```yaml
type: object
required:
  - title
properties:
  title:
    type: string
    nullable: false
    empty_string_accepted: true
    status: required
  note: { type: string, nullable: true, status: optional_when_present }
  full_name: { type: string, nullable: true, status: optional_when_present }
  email: { type: string, nullable: true, status: optional_when_present }
  phone_number: { type: string, nullable: true, status: optional_when_present }
  first_name: { type: string, nullable: true, status: optional_when_present }
  middle_name: { type: string, nullable: true, status: optional_when_present }
  last_name: { type: string, nullable: true, status: optional_when_present }
  birthdate: { type: string, nullable: true, status: optional_when_present }
  gender: { type: string, nullable: true, status: optional_when_present }
  organization: { type: string, nullable: true, status: optional_when_present }
  street_address: { type: string, nullable: true, status: optional_when_present }
  zip_or_postal_code: { type: string, nullable: true, status: optional_when_present }
  city: { type: string, nullable: true, status: optional_when_present }
  state_or_province: { type: string, nullable: true, status: optional_when_present }
  country_or_region: { type: string, nullable: true, status: optional_when_present }
  floor: { type: string, nullable: true, status: optional_when_present }
  county: { type: string, nullable: true, status: optional_when_present }
  social_security_number: { type: string, nullable: true, status: optional_when_present }
  passport_number: { type: string, nullable: true, status: optional_when_present }
  license_number: { type: string, nullable: true, status: optional_when_present }
  website: { type: string, nullable: true, status: optional_when_present }
  x_handle: { type: string, nullable: true, status: optional_when_present }
  second_phone_number: { type: string, nullable: true, status: optional_when_present }
  linkedin: { type: string, nullable: true, status: optional_when_present }
  reddit: { type: string, nullable: true, status: optional_when_present }
  facebook: { type: string, nullable: true, status: optional_when_present }
  yahoo: { type: string, nullable: true, status: optional_when_present }
  instagram: { type: string, nullable: true, status: optional_when_present }
  company: { type: string, nullable: true, status: optional_when_present }
  job_title: { type: string, nullable: true, status: optional_when_present }
  personal_website: { type: string, nullable: true, status: optional_when_present }
  work_phone_number: { type: string, nullable: true, status: optional_when_present }
  work_email: { type: string, nullable: true, status: optional_when_present }
additionalProperties: unknown
```

Evidence:

1. `omit_title` and `title_null` fail.
2. Setting all non-title string fields to `null` succeeds.
3. Omitting specific identity fields was not directly probed, so omission status remains unknown.
4. Unknown top-level keys are accepted by parser/create flow (persistence not separately verified for this type).

## Additional Properties and Freeform Fields

Current evidence for template payloads:

1. Unknown top-level keys are accepted for all tested template create types.
2. Unknown nested keys in `custom.sections[]` and `custom.sections[].fields[]` are accepted.
3. At least for spot-checked items (`login`, `custom`), unknown keys are ignored/dropped in persisted item content.
4. Therefore parser acceptance should not be interpreted as schema-backed stored fields.

What is known outside template payload parsing:

1. `item update --field FIELD=VALUE` supports creating custom fields (explicitly documented for login items).
2. `custom` items provide a structured freeform path via `sections[].fields[]`.

Practical interpretation for MCP contracts:

1. If strictness and model reliability are the priority, prefer explicit per-type schemas and reject unknown keys (`additionalProperties: false`) at MCP validation layer.
2. If forward-compatibility experimentation is needed, unknown keys can be accepted as best-effort inputs, but callers must assume they may be silently ignored by CLI.

## Gaps to Close (If We Want Fully Authoritative Schemas)

1. Probe omission of each non-title field for each type.
2. Expand persistence checks per type to verify whether any unknown keys are retained for item types beyond the spot-checked `login` and `custom`.
3. Probe nested `custom.sections/fields` requiredness and enum strictness.
4. Probe field-format constraints (`email`, `url`, `birthdate`, `security`, etc.) where server-side validation may apply.

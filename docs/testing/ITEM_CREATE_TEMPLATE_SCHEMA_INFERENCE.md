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

## Additional Properties and Freeform Fields

Current evidence does **not** prove top-level `additionalProperties` behavior for template payloads.

What is known:

1. `item update --field FIELD=VALUE` supports creating custom fields (explicitly documented for login items).
2. `custom` items provide a structured freeform path via `sections[].fields[]`.

Practical interpretation for MCP contracts:

1. If strictness and model reliability are the priority, keep per-type create schemas explicit and reject unknown top-level keys.
2. If forward-compatibility experimentation is the priority, allow unknown keys but treat behavior as best-effort and validate against CLI errors.

## Gaps to Close (If We Want Fully Authoritative Schemas)

1. Probe omission of each non-title field for each type.
2. Probe unknown top-level keys per type (`additionalProperties` behavior).
3. Probe nested `custom.sections/fields` requiredness and enum strictness.
4. Probe field-format constraints (`email`, `url`, `birthdate`, `security`, etc.) where server-side validation may apply.

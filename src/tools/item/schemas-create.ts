import { z } from "zod";

import { WIFI_SECURITY_OPTIONS } from "./constants.js";
import { confirmInput } from "../shared/schema-fragments.js";

export const createLoginItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  title: z.string().max(255).describe("Title for the new login item"),
  username: z.string().max(255).optional().describe("Username for the login"),
  email: z.string().max(255).optional().describe("Email for the login"),
  password: z.string().max(1024).optional().describe("Password for the login"),
  url: z.string().max(1024).optional().describe("URL for the login"),
  generatePassword: z
    .string()
    .max(100)
    .optional()
    .describe('Set to "true" to auto-generate, or pass generator options'),
  confirm: confirmInput,
});

export const loginItemTemplateSchema = z
  .object({
    title: z.string().max(255).describe("Title of the login item"),
    urls: z.array(z.string().max(1024)).optional().describe("Optional list of URL strings"),
    username: z.string().max(255).nullable().optional().describe("Optional username"),
    email: z.string().max(255).nullable().optional().describe("Optional email"),
    password: z.string().max(1024).nullable().optional().describe("Optional password"),
  })
  .strict();

export const createLoginItemFromTemplateInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  template: loginItemTemplateSchema.describe("Login template payload"),
  confirm: confirmInput,
});

export const createNoteItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  title: z.string().max(255).describe("Title for the new note item"),
  note: z.string().max(10000).optional().describe("Optional note content"),
  confirm: confirmInput,
});

export const createCreditCardItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  title: z.string().max(255).describe("Title for the new credit card item"),
  cardholderName: z.string().max(255).optional().describe("Cardholder name"),
  number: z.string().max(64).optional().describe("Card number"),
  cvv: z.string().max(16).optional().describe("CVV/CVC security code"),
  expirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM")
    .optional()
    .describe("Expiration date (YYYY-MM)"),
  pin: z.string().max(64).optional().describe("Card PIN"),
  note: z.string().max(10000).optional().describe("Optional note content"),
  confirm: confirmInput,
});

export const createWifiItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  title: z.string().max(255).describe("Title for the new WiFi item"),
  ssid: z.string().min(1).max(255).describe("Network SSID (required, non-empty)"),
  password: z
    .string()
    .max(2048)
    .optional()
    .describe("Network password (optional; empty string for open networks)"),
  security: z
    .enum(WIFI_SECURITY_OPTIONS)
    .optional()
    .describe("WiFi security type: wpa, wpa2, wpa3, wep, open, none"),
  note: z.string().max(10000).optional().describe("Optional note content"),
  confirm: confirmInput,
});

const customTemplateFieldSchema = z
  .object({
    field_name: z.string().min(1).max(255).describe("Field display name"),
    field_type: z.string().min(1).max(100).describe("Field type (for example text, hidden, totp)"),
    value: z.string().max(10000).describe("Field value"),
  })
  .strict();

const customTemplateSectionSchema = z
  .object({
    section_name: z.string().min(1).max(255).describe("Section name"),
    fields: z.array(customTemplateFieldSchema).describe("Fields in this section"),
  })
  .strict();

export const customItemTemplateSchema = z
  .object({
    title: z.string().max(255).describe("Title of the custom item"),
    note: z.string().max(10000).nullable().optional().describe("Optional note"),
    sections: z.array(customTemplateSectionSchema).optional().describe("Optional custom sections"),
  })
  .strict();

export const createCustomItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  template: customItemTemplateSchema.describe("Custom item template payload"),
  confirm: confirmInput,
});

export const identityItemTemplateSchema = z
  .object({
    title: z.string().max(255),
    note: z.string().max(255).nullable().optional(),
    full_name: z.string().max(255).nullable().optional(),
    email: z.string().max(320).nullable().optional(),
    phone_number: z.string().max(255).nullable().optional(),
    first_name: z.string().max(255).nullable().optional(),
    middle_name: z.string().max(255).nullable().optional(),
    last_name: z.string().max(255).nullable().optional(),
    birthdate: z.string().max(255).nullable().optional(),
    gender: z.string().max(255).nullable().optional(),
    organization: z.string().max(255).nullable().optional(),
    street_address: z.string().max(255).nullable().optional(),
    zip_or_postal_code: z.string().max(255).nullable().optional(),
    city: z.string().max(255).nullable().optional(),
    state_or_province: z.string().max(255).nullable().optional(),
    country_or_region: z.string().max(255).nullable().optional(),
    floor: z.string().max(255).nullable().optional(),
    county: z.string().max(255).nullable().optional(),
    social_security_number: z.string().max(255).nullable().optional(),
    passport_number: z.string().max(255).nullable().optional(),
    license_number: z.string().max(255).nullable().optional(),
    website: z.string().max(255).nullable().optional(),
    x_handle: z.string().max(255).nullable().optional(),
    second_phone_number: z.string().max(255).nullable().optional(),
    linkedin: z.string().max(255).nullable().optional(),
    reddit: z.string().max(255).nullable().optional(),
    facebook: z.string().max(255).nullable().optional(),
    yahoo: z.string().max(255).nullable().optional(),
    instagram: z.string().max(255).nullable().optional(),
    company: z.string().max(255).nullable().optional(),
    job_title: z.string().max(255).nullable().optional(),
    personal_website: z.string().max(255).nullable().optional(),
    work_phone_number: z.string().max(255).nullable().optional(),
    work_email: z.string().max(320).nullable().optional(),
  })
  .strict();

export const createIdentityItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  template: identityItemTemplateSchema.describe("Identity item template payload"),
  confirm: confirmInput,
});

export const createItemAliasInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID where alias item will be created"),
    vaultName: z
      .string()
      .max(255)
      .optional()
      .describe("Vault name where alias item will be created"),
    prefix: z.string().min(1).max(255).describe("Alias prefix"),
    output: z.enum(["json", "human"]).default("json").describe("Output format"),
    confirm: confirmInput,
  })
  .refine((input) => !(input.shareId && input.vaultName), {
    message: "Provide only one of shareId or vaultName.",
  });

export type CreateLoginItemInput = z.infer<typeof createLoginItemInputSchema>;
export type CreateLoginItemFromTemplateInput = z.infer<
  typeof createLoginItemFromTemplateInputSchema
>;
export type CreateNoteItemInput = z.infer<typeof createNoteItemInputSchema>;
export type CreateCreditCardItemInput = z.infer<typeof createCreditCardItemInputSchema>;
export type CreateWifiItemInput = z.infer<typeof createWifiItemInputSchema>;
export type CreateCustomItemInput = z.infer<typeof createCustomItemInputSchema>;
export type CreateIdentityItemInput = z.infer<typeof createIdentityItemInputSchema>;
export type CreateItemAliasInput = z.infer<typeof createItemAliasInputSchema>;

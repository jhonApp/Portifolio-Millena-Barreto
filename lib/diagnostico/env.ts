import { z } from "zod";

// Environment configuration, validated per group and only when a group is used,
// so a missing payment key never blocks work that only needs the database.
// Error messages list variable names, never values.

export class ConfigError extends Error {
  group: string;
  missing: string[];

  constructor(group: string, missing: string[]) {
    super(
      `Missing or invalid environment variable(s): ${missing.join(", ")} (group: ${group})`,
    );
    this.name = "ConfigError";
    this.group = group;
    this.missing = missing;
  }
}

const required = z.string().trim().min(1);

function readGroup<S extends z.ZodRawShape>(
  group: string,
  shape: S,
): z.infer<z.ZodObject<S>> {
  const schema = z.object(shape);
  const input: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) input[key] = process.env[key];
  const result = schema.safeParse(input);
  if (!result.success) {
    const missing = Array.from(
      new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    );
    throw new ConfigError(group, missing);
  }
  return result.data;
}

export function getDatabaseEnv() {
  return readGroup("database", {
    SUPABASE_URL: z.string().trim().url(),
    SUPABASE_ANON_KEY: required,
    SUPABASE_SERVICE_ROLE_KEY: required,
  });
}

export function getPaymentEnv() {
  return readGroup("payment", {
    ABACATEPAY_API_KEY: required,
    ABACATEPAY_WEBHOOK_SECRET: required,
  });
}

// RF-05 only creates charges, so it needs the API key alone (the webhook secret belongs to RF-06).
export function getPaymentApiEnv() {
  return readGroup("payment-api", {
    ABACATEPAY_API_KEY: required,
  });
}

export function getEmailEnv() {
  return readGroup("email", {
    RESEND_API_KEY: required,
    EMAIL_FROM: required,
  });
}

export function getAdminEnv() {
  return readGroup("admin", {
    ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  });
}

export function getAppEnv() {
  return readGroup("app", {
    APP_URL: z.string().trim().url(),
    PRIVACY_CONTACT_EMAIL: z.string().trim().email(),
  });
}

export function getSessionEnv() {
  return readGroup("session", {
    SESSION_SECRET: z.string().min(32),
  });
}

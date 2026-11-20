// Fixed values shared by the diagnosis features. The same values are enforced by CHECK
// constraints in supabase/migrations; tests/integration/diagnostico/schema.test.ts keeps both in sync.

export const STYLES = [
  "esportivo_natural",
  "tradicional",
  "elegante",
  "romantico",
  "criativo",
  "dramatico",
] as const;
export type Style = (typeof STYLES)[number];

// Names shown to the customer (pt-BR), shared by the diagnosis, the PDF and the result screen.
export const STYLE_LABELS: Record<Style, string> = {
  esportivo_natural: "Esportivo/Natural",
  tradicional: "Tradicional",
  elegante: "Elegante",
  romantico: "Romântico",
  criativo: "Criativo",
  dramatico: "Dramático",
};

// Diagnosis generation (RF-07): the first run plus 3 retries, after 30 s, 2 min and 10 min.
// The same values are enforced by supabase/migrations/20260101000010_generation_state.sql.
export const MAX_GENERATION_ATTEMPTS = 4;
export const GENERATION_RETRY_DELAYS_SECONDS = [30, 120, 600] as const;

export const ORDER_STATUSES = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "DELIVERED",
  "FAILED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["PENDING", "PAID", "EXPIRED", "FAILED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DELIVERY_PREFERENCES = ["email", "whatsapp", "both"] as const;
export type DeliveryPreference = (typeof DELIVERY_PREFERENCES)[number];

export const DELIVERY_CHANNELS = ["email", "whatsapp"] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export const DELIVERY_STATUSES = ["PENDING", "SENT", "FAILED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const FAILURE_REASONS = [
  "PIX_EXPIRED",
  "GENERATION_FAILED",
  "DELIVERY_FAILED",
  "INVALID_ANSWERS",
  "MISSING_CONTENT",
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

// Price of the diagnosis in cents (R$ 9,90). The server is the only source of this value.
export const PRICE_CENTS = 990;

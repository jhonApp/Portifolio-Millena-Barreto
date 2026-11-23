export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "CONFIG_ERROR"
  | "UPSTREAM_ERROR"
  | "ANSWERS_INCOMPLETE"
  | "VERSION_CHANGED"
  | "UNAVAILABLE"
  | "CHECKOUT_IN_PROGRESS"
  | "PIX_UNAVAILABLE"
  | "PAYMENT_CHECK_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "RESULT_NOT_READY"
  | "LINK_EXPIRED"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  code: ErrorCode;
  status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

// Standard error body used by every diagnosis route:
// { "error": { "code", "message", "fields"? } }
export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  fields?: Record<string, string[]>,
): Response {
  const error: { code: ErrorCode; message: string; fields?: Record<string, string[]> } = {
    code,
    message,
  };
  if (fields) error.fields = fields;
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

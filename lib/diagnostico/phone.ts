// WhatsApp helpers. Pure functions, safe to import in the browser and on the server.

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formats while typing: "11912345678" -> "(11) 91234-5678". Extra digits are ignored. */
export function maskWhatsapp(value: string): string {
  let digits = digitsOnly(value);
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Normalizes a Brazilian mobile number to E.164 ("+55" + 11 digits), or returns null.
 * Rules: optional leading 55; DDD from 11 to 99; mobile number of 9 digits starting with 9.
 */
export function normalizeWhatsapp(value: string): string | null {
  let digits = digitsOnly(value);
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (digits[2] !== "9") return null;
  return `+55${digits}`;
}

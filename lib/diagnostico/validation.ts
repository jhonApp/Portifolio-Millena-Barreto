import { z } from "zod";
import { ApiError } from "./errors";

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; fields: Record<string, string[]> };

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    (fields[key] ??= []).push(issue.message);
  }
  return { ok: false, fields };
}

export const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

export async function readJson(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Corpo da requisição grande demais.", 413);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("INVALID_JSON", "JSON inválido.", 400);
  }
}

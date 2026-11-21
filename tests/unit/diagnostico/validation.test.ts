import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { parseInput, readJson } from "@/lib/diagnostico/validation";

const schema = z.object({ email: z.string().email("Informe um e-mail válido") });

describe("input validation and error format", () => {
  it("parseInput returns data for valid input", () => {
    expect(parseInput(schema, { email: "a@b.com" })).toEqual({
      ok: true,
      data: { email: "a@b.com" },
    });
  });

  it("parseInput returns field errors for invalid input", () => {
    const result = parseInput(schema, { email: "nope" });
    expect(result).toEqual({
      ok: false,
      fields: { email: ["Informe um e-mail válido"] },
    });
  });

  it("apiError builds the documented body", async () => {
    const response = apiError("VALIDATION_ERROR", "Dados inválidos.", 400, {
      email: ["Informe um e-mail válido"],
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos.",
        fields: { email: ["Informe um e-mail válido"] },
      },
    });
  });

  it("readJson rejects a body over the limit", async () => {
    const request = new Request("http://localhost/x", {
      method: "POST",
      body: JSON.stringify({ text: "x".repeat(200) }),
    });
    await expect(readJson(request, 100)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("readJson rejects invalid JSON", async () => {
    const request = new Request("http://localhost/x", { method: "POST", body: "{oops" });
    const promise = readJson(request);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ code: "INVALID_JSON" });
  });
});

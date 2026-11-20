import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAbacatePayGateway } from "@/lib/diagnostico/abacatepay";
import { PixGatewayError } from "@/lib/diagnostico/pix-gateway";

const KEY = "test-key-not-a-real-secret";
const INPUT = {
  orderId: "5d7f0c1e-2b4a-4c8e-9a31-0f6b7e2d9a44",
  amountCents: 990,
  expiresInSeconds: 1800,
  description: "Diagnostico de Estilo Pessoal - Millena Barreto",
};

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.ABACATEPAY_API_KEY;
  process.env.ABACATEPAY_API_KEY = KEY;
});
afterEach(() => {
  if (saved === undefined) delete process.env.ABACATEPAY_API_KEY;
  else process.env.ABACATEPAY_API_KEY = saved;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const okBody = {
  data: {
    id: "pix_char_123",
    brCode: "00020126...",
    brCodeBase64: "data:image/png;base64,AAA",
    expiresAt: "2026-11-20T12:30:00.000Z",
  },
  error: null,
};

function gatewayWith(fetchMock: unknown, timeoutMs?: number) {
  return createAbacatePayGateway({ fetch: fetchMock as typeof fetch, timeoutMs });
}

describe("AbacatePay gateway", () => {
  it("createCharge uses the v2 endpoint and sends amount expiry description and the order id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(okBody));
    await gatewayWith(fetchMock).createCharge(INPUT);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.abacatepay.com/v2/transparents/create");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      method: "PIX",
      data: {
        amount: 990,
        expiresIn: 1800,
        description: INPUT.description,
        externalId: INPUT.orderId,
        metadata: { orderId: INPUT.orderId },
      },
    });
  });

  it("getCharge sends the id as a query parameter and the bearer key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: "pix_char_1", status: "PAID", expiresAt: null }, error: null }));
    await gatewayWith(fetchMock).getCharge("pix_char_1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.abacatepay.com/v2/transparents/check?id=pix_char_1");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("getCharge maps PAID PENDING EXPIRED CANCELLED REFUNDED and unknown statuses", async () => {
    const seen: string[] = [];
    for (const status of ["PAID", "PENDING", "EXPIRED", "CANCELLED", "REFUNDED", "UNDER_DISPUTE", "APPROVED"]) {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: "x", status, expiresAt: null }, error: null }));
      seen.push((await gatewayWith(fetchMock).getCharge("x")).status);
    }
    expect(seen).toEqual(["PAID", "PENDING", "EXPIRED", "CANCELLED", "REFUNDED", "OTHER", "OTHER"]);
  });

  it("a failing check becomes GATEWAY_UNAVAILABLE", async () => {
    await expect(gatewayWith(vi.fn().mockRejectedValue(new TypeError("x"))).getCharge("x")).rejects.toMatchObject({
      code: "GATEWAY_UNAVAILABLE",
    });
    await expect(gatewayWith(vi.fn().mockResolvedValue(jsonResponse({}, 502))).getCharge("x")).rejects.toMatchObject({
      code: "GATEWAY_UNAVAILABLE",
    });
  });

  it("a check without a status becomes GATEWAY_BAD_RESPONSE", async () => {
    await expect(gatewayWith(vi.fn().mockResolvedValue(jsonResponse({ data: {} }))).getCharge("x")).rejects.toMatchObject({
      code: "GATEWAY_BAD_RESPONSE",
    });
  });

  it("the key never appears in an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    let error: unknown;
    try {
      await gatewayWith(fetchMock).getCharge("x");
    } catch (e) {
      error = e;
    }
    expect((error as Error).message).not.toContain(KEY);
  });

  it("the request body has no customer or card data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(okBody));
    await gatewayWith(fetchMock).createCharge(INPUT);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("customer");
    expect(body.data).not.toHaveProperty("customer");
    expect(JSON.stringify(body)).not.toMatch(/card|cpf|taxId|email|cellphone/i);
  });

  it("sends the bearer key and never puts it in an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "denied" }, 401));
    let error: unknown;
    try {
      await gatewayWith(fetchMock).createCharge(INPUT);
    } catch (e) {
      error = e;
    }
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(error).toBeInstanceOf(PixGatewayError);
    expect((error as Error).message).not.toContain(KEY);
  });

  it("maps a successful response to a PixCharge", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(okBody));
    const charge = await gatewayWith(fetchMock).createCharge(INPUT);
    expect(charge).toEqual({
      chargeId: "pix_char_123",
      pixCode: "00020126...",
      qrImage: "data:image/png;base64,AAA",
      expiresAt: "2026-11-20T12:30:00.000Z",
    });
  });

  it("a non-2xx answer becomes GATEWAY_REJECTED", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "bad" }, 400));
    await expect(gatewayWith(fetchMock).createCharge(INPUT)).rejects.toMatchObject({ code: "GATEWAY_REJECTED" });
  });

  it("a server error becomes GATEWAY_UNAVAILABLE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(gatewayWith(fetchMock).createCharge(INPUT)).rejects.toMatchObject({ code: "GATEWAY_UNAVAILABLE" });
  });

  it("a network failure becomes GATEWAY_UNAVAILABLE", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(gatewayWith(fetchMock).createCharge(INPUT)).rejects.toMatchObject({ code: "GATEWAY_UNAVAILABLE" });
  });

  it("a response without code or id becomes GATEWAY_BAD_RESPONSE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: "x" } }));
    await expect(gatewayWith(fetchMock).createCharge(INPUT)).rejects.toMatchObject({ code: "GATEWAY_BAD_RESPONSE" });
  });

  it("a slow answer is aborted at the timeout", async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    await expect(gatewayWith(fetchMock, 20).createCharge(INPUT)).rejects.toMatchObject({
      code: "GATEWAY_UNAVAILABLE",
    });
  });
});

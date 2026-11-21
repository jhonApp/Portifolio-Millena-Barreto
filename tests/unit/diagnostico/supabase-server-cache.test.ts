import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin, getSupabaseAnon } from "@/lib/diagnostico/supabase-server";

// Next.js keeps successful GET responses of the patched fetch in its Data Cache. The server clients
// must opt out of it: otherwise a revoked token, an expired link or an erased customer (RF-09) is
// still answered from the cache. This was found in the RF-09 browser check, where an erased
// customer's result link kept showing the diagnosis.

const calls: { url: string; cache: RequestCache | undefined }[] = [];

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_ANON_KEY", "anon-key-for-test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key-for-test");
  calls.length = 0;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), cache: init?.cache });
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("server database clients", () => {
  it("every request of the service client and of the anon client is sent with cache no-store", async () => {
    await getSupabaseAdmin().from("orders").select("id").limit(1);
    await getSupabaseAnon().from("customers").select("id").limit(1);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const call of calls) expect(call.cache, call.url).toBe("no-store");
  });
});

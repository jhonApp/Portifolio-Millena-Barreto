import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, createCustomer, TABLES } from "./helpers";

const admin = adminClient();
let customerId = "";
let userId = "";
let authenticated: SupabaseClient;
const email = `rls-${randomUUID()}@example.com`;
const password = `Pw-${randomUUID()}`;

beforeAll(async () => {
  const customer = await createCustomer(admin);
  customerId = customer.id;

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw new Error(created.error.message);
  userId = created.data.user.id;

  authenticated = anonClient();
  const signedIn = await authenticated.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(signedIn.error.message);
});

afterAll(async () => {
  await admin.from("customers").delete().eq("id", customerId);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

async function assertNoRead(client: SupabaseClient, table: string) {
  const { data, error } = await client.from(table).select("*").limit(5);
  // Either a permission error or no rows at all: never data.
  expect(error !== null || (data ?? []).length === 0, `read ${table}`).toBe(true);
}

async function assertNoWrite(client: SupabaseClient, table: string) {
  const insert = await client.from(table).insert({});
  expect(insert.error, `insert ${table}`).not.toBeNull();
  const update = await client.from(table).update({ id: randomUUID() }).not("id", "is", null);
  expect(update.error !== null || (update.data ?? []).length === 0, `update ${table}`).toBe(true);
  const del = await client.from(table).delete().not("id", "is", null);
  expect(del.error !== null || (del.data ?? []).length === 0, `delete ${table}`).toBe(true);
}

describe("access lockdown", () => {
  it("service role can still read the data (sanity check)", async () => {
    const { data, error } = await admin.from("customers").select("id").eq("id", customerId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("anon role cannot read any diagnostico table", async () => {
    const anon = anonClient();
    for (const table of TABLES) await assertNoRead(anon, table);
  });

  it("anon role cannot insert update or delete", async () => {
    const anon = anonClient();
    for (const table of TABLES) await assertNoWrite(anon, table);
    const { data } = await admin.from("customers").select("name").eq("id", customerId).single();
    expect(data?.name).toBe("Maria Teste Silva");
  });

  it("authenticated role cannot read or write", async () => {
    for (const table of TABLES) {
      await assertNoRead(authenticated, table);
      await assertNoWrite(authenticated, table);
    }
    const { data } = await admin.from("customers").select("id").eq("id", customerId);
    expect(data).toHaveLength(1);
  });
});

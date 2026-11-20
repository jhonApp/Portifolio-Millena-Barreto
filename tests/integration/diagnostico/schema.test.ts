import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  DELIVERY_PREFERENCES,
  FAILURE_REASONS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  STYLES,
} from "@/lib/diagnostico/constants";
import {
  adminClient,
  createAttempt,
  createCustomer,
  createOrder,
  createQuestion,
  createVersion,
  validContent,
  validPoints,
} from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const versionIds: string[] = [];

async function newOrder(status = "PENDING") {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  const attempt = await createAttempt(db, customer.id);
  const order = await createOrder(db, attempt.id, status);
  return { customer, attempt, order };
}

async function newVersion() {
  const version = await createVersion(db);
  versionIds.push(version.id);
  return version;
}

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  if (versionIds.length) await db.from("questionnaire_versions").delete().in("id", versionIds);
});

describe("schema constraints", () => {
  it("accepts every style key and rejects an unknown one", async () => {
    const version = await newVersion();
    const q1 = await createQuestion(db, version.id, 1);
    const q2 = await createQuestion(db, version.id, 2);
    for (let index = 0; index < STYLES.length; index++) {
      const style = STYLES[index];
      const target = index < 4 ? q1 : q2;
      const position = index < 4 ? index + 1 : index - 3;
      const { error } = await db
        .from("alternatives")
        .insert({ question_id: target.id, position, text: style, style });
      expect(error, `style ${style}`).toBeNull();
    }
    const q3 = await createQuestion(db, version.id, 3);
    const { error } = await db
      .from("alternatives")
      .insert({ question_id: q3.id, position: 1, text: "x", style: "sexy" });
    expect(error).not.toBeNull();
  });

  it("rejects a second published questionnaire version", async () => {
    const first = await createVersion(db, "published");
    versionIds.push(first.id);
    const { error } = await db
      .from("questionnaire_versions")
      .insert({ version: first.version + 1, status: "published" });
    expect(error).not.toBeNull();
    await db.from("questionnaire_versions").update({ status: "archived" }).eq("id", first.id);
  });

  it("accepts every order status and rejects an unknown one", async () => {
    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    const attempt = await createAttempt(db, customer.id);
    for (const status of ORDER_STATUSES) {
      const { error } = await db.from("orders").insert({
        attempt_id: attempt.id,
        amount_cents: 990,
        status,
        failure_reason: status === "FAILED" ? "PIX_EXPIRED" : null,
      });
      expect(error, `status ${status}`).toBeNull();
    }
    const { error } = await db
      .from("orders")
      .insert({ attempt_id: attempt.id, amount_cents: 990, status: "UNKNOWN" });
    expect(error).not.toBeNull();
  });

  it("failure_reason only allowed when status is FAILED", async () => {
    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    const attempt = await createAttempt(db, customer.id);
    const pending = await db.from("orders").insert({
      attempt_id: attempt.id,
      amount_cents: 990,
      status: "PENDING",
      failure_reason: "PIX_EXPIRED",
    });
    expect(pending.error).not.toBeNull();
    for (const reason of FAILURE_REASONS) {
      const { error } = await db.from("orders").insert({
        attempt_id: attempt.id,
        amount_cents: 990,
        status: "FAILED",
        failure_reason: reason,
      });
      expect(error, `reason ${reason}`).toBeNull();
    }
  });

  it("accepts every delivery preference and payment status", async () => {
    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    for (const preference of DELIVERY_PREFERENCES) {
      const { error } = await db
        .from("purchase_attempts")
        .insert({ customer_id: customer.id, delivery_preference: preference });
      expect(error, `preference ${preference}`).toBeNull();
    }
    const bad = await db
      .from("purchase_attempts")
      .insert({ customer_id: customer.id, delivery_preference: "sms" });
    expect(bad.error).not.toBeNull();

    const { order } = await newOrder();
    for (const status of PAYMENT_STATUSES) {
      const { error } = await db.from("payments").insert({
        order_id: order.id,
        provider_charge_id: `chg_${randomUUID()}`,
        status,
        amount_cents: 990,
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
      });
      expect(error, `payment ${status}`).toBeNull();
    }
  });

  it("rejects secondary equal to predominant", async () => {
    const { order } = await newOrder("APPROVED");
    const version = await newVersion();
    const { error } = await db.from("results").insert({
      order_id: order.id,
      version_id: version.id,
      points: validPoints,
      predominant_style: "elegante",
      secondary_style: "elegante",
      content: validContent,
    });
    expect(error).not.toBeNull();
  });

  it("rejects a result for a PENDING order", async () => {
    const { order } = await newOrder("PENDING");
    const version = await newVersion();
    const { error } = await db.from("results").insert({
      order_id: order.id,
      version_id: version.id,
      points: validPoints,
      predominant_style: "elegante",
      secondary_style: "romantico",
      content: validContent,
    });
    expect(error?.message).toContain("order must be APPROVED, PROCESSING or DELIVERED");
  });

  it("accepts a result for an APPROVED order", async () => {
    const { order } = await newOrder("APPROVED");
    const version = await newVersion();
    const { error } = await db.from("results").insert({
      order_id: order.id,
      version_id: version.id,
      points: validPoints,
      predominant_style: "elegante",
      secondary_style: "romantico",
      content: validContent,
    });
    expect(error).toBeNull();
  });

  it("rejects a delivery for a PENDING order and accepts every status for a paid one", async () => {
    const pending = await newOrder("PENDING");
    const rejected = await db
      .from("deliveries")
      .insert({ order_id: pending.order.id, channel: "email" });
    expect(rejected.error?.message).toContain("order must be APPROVED");

    const paid = await newOrder("APPROVED");
    const email = await db
      .from("deliveries")
      .insert({ order_id: paid.order.id, channel: "email", status: "PENDING" });
    expect(email.error).toBeNull();
    const whatsapp = await db
      .from("deliveries")
      .insert({ order_id: paid.order.id, channel: "whatsapp", status: "SENT" });
    expect(whatsapp.error).toBeNull();
    const failed = await db
      .from("deliveries")
      .update({ status: "FAILED" })
      .eq("order_id", paid.order.id)
      .eq("channel", "email");
    expect(failed.error).toBeNull();
    const invalid = await db
      .from("deliveries")
      .update({ status: "LOST" })
      .eq("order_id", paid.order.id)
      .eq("channel", "email");
    expect(invalid.error).not.toBeNull();
  });

  it("rejects a duplicate webhook event id", async () => {
    const eventId = `evt_${randomUUID()}`;
    const first = await db
      .from("webhook_events")
      .insert({ event_id: eventId, event_type: "paid", payload: {} });
    expect(first.error).toBeNull();
    const second = await db
      .from("webhook_events")
      .insert({ event_id: eventId, event_type: "paid", payload: {} });
    expect(second.error).not.toBeNull();
    await db.from("webhook_events").delete().eq("event_id", eventId);
  });

  it("deleting a customer cascades to attempts answers consent and orders", async () => {
    const { customer, attempt, order } = await newOrder("APPROVED");
    await db.from("consent_records").insert({
      attempt_id: attempt.id,
      customer_id: customer.id,
      consent_text_version: "v1",
      consent_text: "Autorizo",
    });
    const del = await db.from("customers").delete().eq("id", customer.id);
    expect(del.error).toBeNull();
    const attempts = await db.from("purchase_attempts").select("id").eq("id", attempt.id);
    const orders = await db.from("orders").select("id").eq("id", order.id);
    const consents = await db.from("consent_records").select("id").eq("attempt_id", attempt.id);
    expect(attempts.data).toEqual([]);
    expect(orders.data).toEqual([]);
    expect(consents.data).toEqual([]);
  });

  it("updated_at changes on update", async () => {
    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const { data } = await db
      .from("customers")
      .update({ name: "Maria Atualizada Silva" })
      .eq("id", customer.id)
      .select()
      .single();
    expect(new Date(data!.updated_at).getTime()).toBeGreaterThan(
      new Date(customer.updated_at).getTime(),
    );
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, anonClient } from "./helpers";

const admin = adminClient();
const BUCKET = "diagnostics";
const uploaded: string[] = [];

// Minimal valid-looking PDF bytes.
const pdfBytes = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

afterAll(async () => {
  if (uploaded.length) await admin.storage.from(BUCKET).remove(uploaded);
});

describe("storage bucket diagnostics", () => {
  it("bucket diagnostics is private", async () => {
    const { data, error } = await admin.storage.getBucket(BUCKET);
    expect(error).toBeNull();
    expect(data?.public).toBe(false);
    expect(data?.file_size_limit).toBe(2097152);
    expect(data?.allowed_mime_types).toEqual(["application/pdf"]);
  });

  it("anon cannot list or download from diagnostics", async () => {
    const path = `rls-${randomUUID()}.pdf`;
    const up = await admin.storage
      .from(BUCKET)
      .upload(path, pdfBytes, { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    uploaded.push(path);

    const anon = anonClient();
    const listed = await anon.storage.from(BUCKET).list();
    expect(listed.error !== null || (listed.data ?? []).length === 0).toBe(true);
    const downloaded = await anon.storage.from(BUCKET).download(path);
    expect(downloaded.error).not.toBeNull();
    const publicUrl = anon.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const response = await fetch(publicUrl);
    expect(response.ok).toBe(false);
  });

  it("rejects a non-PDF upload", async () => {
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(`bad-${randomUUID()}.txt`, new TextEncoder().encode("hello"), {
        contentType: "text/plain",
      });
    expect(error).not.toBeNull();
  });

  it("rejects a file larger than 2 MB", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1024);
    big.set(pdfBytes);
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(`big-${randomUUID()}.pdf`, big, { contentType: "application/pdf" });
    expect(error).not.toBeNull();
  });
});

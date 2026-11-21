import { describe, expect, it } from "vitest";
import {
  DELETION_DONE_SUBJECT,
  DELETION_REQUEST_BUTTON,
  DELETION_REQUEST_SUBJECT,
  renderDeletionDoneEmail,
  renderDeletionRequestEmail,
} from "@/lib/diagnostico/deletion-email";

const LINK = "http://localhost:3001/diagnostico-estilo/privacidade/exclusao/abc123";
const POLICY = "http://localhost:3001/diagnostico-estilo/privacidade";

describe("deletion e-mails", () => {
  it("the confirmation e-mail carries the link and the policy link", () => {
    const { subject, html, text } = renderDeletionRequestEmail({ link: LINK, privacyUrl: POLICY });
    expect(subject).toBe(DELETION_REQUEST_SUBJECT);
    for (const part of [LINK, POLICY]) {
      expect(html).toContain(part);
      expect(text).toContain(part);
    }
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain(DELETION_REQUEST_BUTTON);
    expect(text).toContain("24 horas");
  });

  it("the completion e-mail has no personal data", () => {
    const { subject, html, text } = renderDeletionDoneEmail({ privacyUrl: POLICY });
    expect(subject).toBe(DELETION_DONE_SUBJECT);
    for (const body of [html, text]) {
      expect(body).not.toMatch(/@/);
      expect(body).toContain("Exclusão concluída");
    }
    expect(html).toContain(POLICY);
    expect(text).toContain(POLICY);
  });

  it("escapes and declares utf-8", () => {
    const { html } = renderDeletionRequestEmail({ link: 'http://x/"><script>', privacyUrl: POLICY });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('<meta charset="utf-8">');
    expect(renderDeletionDoneEmail({ privacyUrl: POLICY }).html).toContain('<meta charset="utf-8">');
  });

  it("the text versions have no html", () => {
    expect(renderDeletionRequestEmail({ link: LINK, privacyUrl: POLICY }).text).not.toMatch(/<[a-z][^>]*>/i);
    expect(renderDeletionDoneEmail({ privacyUrl: POLICY }).text).not.toMatch(/<[a-z][^>]*>/i);
  });
});

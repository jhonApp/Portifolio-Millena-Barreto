import "server-only";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { DiagnosisDocument, registerPdfFonts } from "./diagnosis-pdf";
import type { DiagnosisContent } from "./schemas/diagnosis-content";

export const PDF_RENDER_TIMEOUT_MS = 10_000;

export class PdfRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfRenderError";
  }
}

/**
 * Renders the diagnosis to PDF bytes. A render that takes longer than the limit is abandoned
 * and reported as a failure (the caller counts it as an attempt).
 */
export async function renderDiagnosisPdf(
  content: DiagnosisContent,
  options: {
    timeoutMs?: number;
    customerName?: string;
    /** Replaces the library renderer (tests only: a renderer that never finishes proves the limit). */
    renderer?: (element: unknown) => Promise<Uint8Array>;
  } = {},
): Promise<Uint8Array> {
  const timeoutMs = options.timeoutMs ?? PDF_RENDER_TIMEOUT_MS;
  registerPdfFonts();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new PdfRenderError("the PDF render exceeded the time limit")), timeoutMs);
  });
  try {
    const element = createElement(DiagnosisDocument, {
      content,
      customerName: options.customerName ?? content.customer.firstName,
    });
    // renderToBuffer takes the document element; the cast keeps the library types out of our code.
    // The limit protects against a render that stalls; layout work itself is synchronous.
    const render = options.renderer ?? ((el: unknown) => renderToBuffer(el as never));
    const bytes = await Promise.race([render(element), timeout]);
    return new Uint8Array(bytes);
  } catch (error) {
    if (error instanceof PdfRenderError) throw error;
    throw new PdfRenderError(error instanceof Error ? error.message : "the PDF render failed");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

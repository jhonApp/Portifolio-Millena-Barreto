import { handleWebhook } from "./handler";

export const dynamic = "force-dynamic";
// The request that approves an order also runs the first generation (a few seconds).
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return handleWebhook(request);
}

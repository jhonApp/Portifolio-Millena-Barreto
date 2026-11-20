import { handleWebhook } from "./handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleWebhook(request);
}

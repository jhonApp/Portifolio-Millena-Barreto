import { handleCheckout } from "./handler";

export const dynamic = "force-dynamic";

// Returns the Pix of the attempt: the valid one, a first one, or "expired" (never replaces an expired Pix).
export async function POST(request: Request): Promise<Response> {
  return handleCheckout(request, false);
}

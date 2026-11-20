import { handleCheckout } from "../handler";

export const dynamic = "force-dynamic";

// "Gerar novo Pix": like the checkout call, but an expired Pix is replaced by a new order.
export async function POST(request: Request): Promise<Response> {
  return handleCheckout(request, true);
}

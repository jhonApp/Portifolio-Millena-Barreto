import { handleResultResend } from "./handler";

export const dynamic = "force-dynamic";
// The e-mail with the PDF is sent inside the request.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return handleResultResend(request);
}
